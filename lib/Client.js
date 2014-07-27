window.irc = window.irc || {};

/** Utility to compose mixins from different objects.
 * @param {Object} target Object to augment. Cannot be null.
 * @param {Object...} source Any number of objects to copy. Cannot be null.
 * @return {Object} Returns the target object, never null.
 */
irc.extend = function (target/*,[sourceN]*/) {
  var property;
  var i;
  var source;
  for (i = 1; i < arguments.length; i++) {
    source = arguments[i];

    for (property in source) {
      target[property] = source[property];
    }
  }
  return target;
};

/** IRC error codes.
 * http://tools.ietf.org/html/rfc2812#section-5.2
 */
irc.Errors = {
  ERR_NOSUCHNICK: 401,
  ERR_UNAVAILRESOURCE: 437,
  ERR_INVITEONLYCHAN: 473,
  ERR_CHANNELISFULL: 471,
  ERR_NOSUCHCHANNEL: 403,
  ERR_TOOMANYTARGETS: 407,
  ERR_BANNEDFROMCHAN: 474,
  ERR_BADCHANNELKEY: 475,
  ERR_BADCHANMASK: 476,
  ERR_TOOMANYCHANNELS: 405,
  ERR_CANNOTSENDTOCHAN: 404
};

/** Lightweight IRC client.
 * @param {String} nick Nick name to use in the server. Cannot be null.
 * @param {Object} server Server information. Cannot be null.
 * @param {String} server.host Address of the IRC host. Cannot be null or empty.
 * @param {Number} server.port Port number to connect to. Cannot be null.
 * @param {Object} server.proxy IRC proxy information to use when the browser
 *    does not support native sockets. Cannot be null.
 * @param {String} server.proxy.host Address of the IRC proxy host. Cannot be
 *    null or empty.
 * @param {Number} server.proxy.port Port number to connect to. Cannot be null.
 * @constructor
 */
irc.Client = function (nick, server) {

  /** Client instance.
   * @private
   * @fieldOf irc.Client#
   */
  var client = this;

  /** Mapping from channel names to channels to which the current user has
   * joined.
   * @type {Object[String => Channel]}
   * @private
   */
  var channels = {};

  /** List of users in all known channels. When the current user enters into a
   * channel, the list of users in the channel are added to this list. It is
   * updated on parts/joins/quits/whois.
   *
   * @type {Object[]}
   * @private
   * @fieldOf irc.Client#
   */
  var users = [];

  /** Connection to the irc server.
   * @type {irc.Connection}
   * @private
   * @fieldOf irc.Client#
   */
  var connection = new irc.Connection(nick, server);

  /** Represents a user in the irc server.
   * @param {String} nick User nick. Cannot be null.
   * @constructor
   */
  var User = function (nick) {
    return irc.extend(new irc.EventEmitter(), {

      /** User nickname, it's nerver null. */
      nick: nick.trim(),

      /** List of channels the user is currently on, it's never null. */
      channels: [],

      /** Sends a private message to this user.
       * @param {String} message Message to send. Cannot be null or empty.
       */
      message: function (text) {
        client.message(nick, text);
      },

      /** Asks the WHOIS for this user. The result is provided in the 'whois'
       * event.
       */
      whois: function () {
        client.send("WHOIS " + nick.trim());
      }
    });
  };

  /** Represents a channel in the irc server.
   * @param {String} channelName Name of the channel. Cannot be null or empty.
   * @constructor
   */
  var Channel = function (channelName) {

    return irc.extend(new irc.EventEmitter(), {
      /** Channel name, it's never null.
       */
      name: channelName,

      /** Returns the list of users in this channel.
       * @return {String[]} A list of user names, never null.
       */
      names: function () {
        return users.filter(function (user) {
          return user.channels.indexOf(channelName) > -1;
        });
      },

      /** Leaves this channel.
       */
      part: function () {
        client.part(channelName);
      },

      /** Sends a message to this channel.
       * @param {String} message Message to send. Cannot be null or empty.
       */
      message: function (message) {
        client.message(channelName, message);
      }
    });
  };

  /** Finds a user by its nickname or ident.
   * @param {String} criteria Search criteria. Cannot be null or empty.
   * @return {User} Returns the required user, or null if it isn't found.
   * @private
   * @methodOf irc.Client#
   */
  var findUser = function (criteria) {
    return users.find(function (user) {
      return user.nick === criteria ||
        user.ident === criteria.trim();
    });
  };

  /** Extracts the user name from a message prefix.
   * @param {String} prefix Prefix to extract user name from. Cannot be null or
   *    empty.
   * @return {String} The user name, never null.
   * @private
   * @methodOf irc.Client#
   */
  var getUserName = function (prefix) {
    return prefix.substr(0, prefix.indexOf("!"));
  };

  /** Default error handler. It emits an "error" event in the client and pass an
   * error object as parameter with error information.
   * @param {Object} message IRC message with the error information. Cannot be
   *    null.
   * @private
   * @methodOf irc.Client#
   */
  var defaultErrorHandler = function (message) {
    var targetName = message.params[1];
    var error = new Error(message.params[2]);
    var target = channels[targetName];

    if (!target) {
      target = findUser(targetName);
    }
    error.code = parseInt(message.command, 10);
    error.target = target;

    client.emit("error", error);
  };

  /** Supported IRC commands.
   */
  var Commands = {
    /** http://tools.ietf.org/html/rfc2812#section-3.2.1
     */
    JOIN: {
      id: "join",
      handler: function (message) {
        var channel = channels[message.params[0].trim().toLowerCase()];
        channel.emit("join", findUser(getUserName(message.prefix)));
      }
    },

    /** http://tools.ietf.org/html/rfc2812#section-3.2.2
     */
    PART: {
      id: "part",
      handler: function (message) {
        var user = findUser(getUserName(message.prefix));
        var channelIndex = user.channels.indexOf(message.params[0]);

        if (channelIndex > -1) {
          user.channels.splice(channelIndex, 1);
        }

        channel.emit("part", {
          user: findUser(getUserName(message.prefix)),
          message: message.params[1]
        });
      }
    },

    /** http://tools.ietf.org/html/rfc2812#section-3.3
     */
    PRIVMSG: {
      id: "privmsg",
      handler: function (message) {
        var channel = channels[message.params[0].trim().toLowerCase()];
        var user;

        if (channel) {
          channel.emit("message", {
            user: findUser(getUserName(message.prefix)),
            text: message.params[1]
          });
        } else {
          // User message
          user = findUser(getUserName(message.prefix));
          user.emit("message", message.params[1]);
        }
      }
    },

    /** http://tools.ietf.org/html/rfc2812#section-3.1.7
     */
    QUIT: {
      id: "quit",
      handler: function (message) {
        var user = findUser(getUserName(message.prefix));
        var userIndex = users.indexOf(user);
        if (userIndex > -1) {
          users.splice(users.indexOf(user), 1);
        }
        client.emit("quit", {
          user: user,
          message: message.params[2]
        });
      }
    },

    /** Reply with the list of names in a channel.
     * http://tools.ietf.org/html/rfc2812#section-3.2.5
     */
    RPL_NAMREPLY: {
      id: 353,
      handler: function (message) {
        // Extracts the user names and removes the mode character.
        message.params[3].split(" ").forEach(function (user) {
          var mode = user.substr(0, 1);
          var nick = user.trim();
          var user;

          if (mode == "@" || mode === "+") {
            nick = user.substr(1);
          }
          user = findUser(nick);

          if (!user) {
            users.push(new User(nick));
          }
        });
      }
    },

    /** End of channel names listing.
     * http://tools.ietf.org/html/rfc2812#section-3.2.5
     */
    RPL_ENDOFNAMES: {
      id: 366,
      handler: function (message) {
        var channel = channels[message.params[1].trim()];
        if (!channel) {
          throw new Error("Invalid NAMES reply.");
        }
        channel.emit("ready");
      }
    },

    /** Reply to a WHOIS message on a user.
     * http://tools.ietf.org/html/rfc2812#section-3.6.2
     */
    RPL_WHOISUSER: {
      id: 311,
      handler: function (message) {
        var user = findUser(message.params[1]);

        if (!user) {
          user = new User(message.params[1].trim());
          users.push(user);
        }

        irc.extend(user, {
          user: message.params[2],
          host: message.params[3],
          realName: message.params[5]
        });
      }
    },

    /** List of channels in which a user is joined. Part of the WHOIS reply.
     * http://tools.ietf.org/html/rfc2812#section-3.6.2
     */
    RPL_WHOISCHANNELS: {
      id: 319,
      handler: function (message) {
        var user = findUser(message.params[1]);

        user.channels = message.params[2].split(" ").map(function (channel) {
          var mode = channel.substr(0, 1);
          if (mode === "+" || mode === "@") {
            return channel.substr(1);
          } else {
            return channel;
          }
        });
      }
    },

    /** All WHOIS information already sent.
     * http://tools.ietf.org/html/rfc2812#section-3.6.2
     */
    RPL_ENDOFWHOIS: {
      id: 318,
      handler: function (message) {
        var user = findUser(message.params[1]);
        if (user) {
          user.emit("whois", user);
        }
      }
    },

    /** Special treatment for No Such Nick error. It removes the user from the
     * list if it does exist.
     */
    ERR_NOSUCHNICK: {
      id: 401,
      handler: function (message) {
        var user = findUser(message.params[1].trim());
        if (user) {
          users = users.filter(function (currentUser) {
            return currentUser.nick !== user.nick;
          });
          user.emit("error", new Error(message.params[2]));
        }
      }
    }
  };

  /** Automatically registers listeners for supported commands.
   * @private
   * @methodOf irc.Client#
   */
  var registerCommands = function () {
    var commandName;
    var command;
    for (commandName in Commands) {
      if (Commands.hasOwnProperty(commandName)) {
        command = Commands[commandName];

        connection.on(command.id, command.handler);
      }
    }
    for (commandName in irc.Errors) {
      if (irc.Errors.hasOwnProperty(commandName)) {
        connection.on(irc.Errors[commandName], defaultErrorHandler);
      }
    }
  };

  return irc.extend(client, new irc.EventEmitter(), {

    /** Connects to the irc server and initializes the client.
     * @param {Function} callback Callback invoked when the connection is
     *    established. Cannot be null.
     */
    connect: function (callback) {
      connection.open(function (err) {
        if (err) {
          return callback(err);
        }

        registerCommands();
        callback();
      });
    },

    /** Joins to a channel only if the user is not already in the channel.
     *
     * @param {String} channelName Name of the channel to join to. Cannot be
     *    null or empty.
     * @param {String} key Channel key, if any. Can be null.
     * @return {Channel} Returns the channel, never null.
     */
    join: function (channelName, key) {
      var message = "JOIN " + channelName;
      var channelId = channelName.toLowerCase();

      if (channels.hasOwnProperty(channelId)) {
        return channels[channelId];
      }

      channels[channelId] = new Channel(channelName);

      if (key) {
        message += " " + key;
      }
      connection.send(message);

      return channels[channelId];
    },

    /** Quits the IRC server and sends the specified quit message.
     * @param {String} [message] Quit message. Can be null.
     */
    quit: function (message) {
      connection.send("QUIT " + message);
    },

    /** Leaves a channel.
     * @param {String} channelName Channel to leave. Cannot be null or empty.
     */
    part: function (channelName) {
      connection.send("PART " + channelName);
    },

    /** Sends a message to a user or a channel.
     * @param {String} targetName Name of the channel or nick. Cannot be null
     *    or empty.
     * @param {String} message Message to send. Cannot be null or empty.
     */
    message: function (targetName, message) {
      connection.send("PRIVMSG " + targetName + " :" + message);
    },

    /** Returns the specified user. It peforms a whois and emits an error if the
     * user does not exist in the server.
     * @param {String} nick User nickname. Cannot be null or empty.
     * @return {User} Returns the required user, never null.
     */
    user: function (nick) {
      var user = findUser(nick.trim());

      if (!user) {
        user = new User(nick);
        users.push(user);
      }

      connection.send("WHOIS " + nick);

      return user;
    },

    /** Returns the connection to the irc server.
     * @return {irc.Connection} A valid connection, never null.
     */
    getConnection: function () {
      return connection;
    }
  });
};
