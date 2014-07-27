window.irc = window.irc || {};

/** Represents a connection to a irc server. It performs the initial handshake
 * and keeps the connection alive answering to pings.
 *
 * It is an <code>irc.EventEmmitter</code> so clients can subscribe to server
 * commands. Irc protocol is completely asynchrounous, any command received from
 * the server must be handled in the order it is sent by the server. This
 * connection triggers command events according to this order.
 *
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
irc.Connection = function (nick, server) {

  /** Current connection instance.
   * @type {irc.Connection}
   * @private
   * @fieldOf irc.Connection#
   */
  var connection = this;

  /** Last part of an incomplete IRC message. I may occur when the message is
   * truncated due TCP frames limitations.
   *
   * @type {String}
   * @private
   * @fieldOf irc.Connection#
   */
  var incomplete = null;

  /** Supported server features.
   * @type {Object[String => String]}
   * @private
   * @fieldOf irc.Connection#
   */
  var features = {};

  /** Callback invoked when the connection is initialized, aka the server
   * sent the motd message.
   * @type {Function}
   * @private
   * @fieldOf irc.Connection#
   */
  var initCallback;

  /** Built-in message handlers.
   * @namespace
   * @type {Object}
   * @private
   * @fieldOf irc.Connection#
   */
  var DefaultHandlers = {

    /** Triggers the initialization callback after RPL_ENDOFMOTD message.
     *
     * @param {Object} message Message to process. Cannot be null.
     */
    "376": function (message) {
      initCallback();
    },

    /** Nick already in use. Tries to use another nick.
     * @param {Object} message Message to process. Cannot be null.
     */
    "433": function (message) {
      transport.send("NICK " + nick + "_");
    },

    /** Saves server supported features indicated in RPL_ISUPPORT message.
     * @param {Object} message Message to process. Cannot be null.
     */
    "005": function (message) {
      var i;
      var param;
      var valuePos;

      for (i = 1; i < message.params.length; i++) {
        param = message.params[i];
        valuePos = param.indexOf("=");

        if (valuePos > -1) {
          features[param.substr(0, valuePos)] = param.substr(valuePos + 1);
        } else {
          features[param] = 1;
        }
      }
    },

    /** PING message handler.
     *
     * NOTE: it does not manage pings from multiple servers.
     *
     * @param {Object} message Message to process. Cannot be null.
     *
     * @see http://tools.ietf.org/html/rfc2812#section-3.7.2
     */
    ping: function (message) {
      var server = message.trailing;

      if (message.params.length) {
        server = message.params[message.params.length - 1];
      }

      transport.send("PONG " + server);
    },

    /** Server sent a fatal error and closed the connection.
     *
     * See http://tools.ietf.org/html/rfc2812#section-3.7.4
     *
     * @param {Object} message Message to process. Cannot be null.
     */
    error: function (message) {
      initCallback(new Error(message.params[0]));
    }
  };

  /** Handles a server response. This is the entry point for all IRC messages.
   *
   * As the server may enqueue serveral outgoing messages, the response may
   * consist of a set of messages separated according to the RFC by CRLF.
   *
   * Due TCP frame limitation, the last message may come incomplete. This method
   * detects incomplete messages and process them in the next response.
   *
   * @private
   * @methodOf irc.Connection#
   */
  var handleMessage = function (rawResponse) {
    var lines = rawResponse.split("\n");
    var rawMessage;
    var message;
    var command;

    // Checks whether there's an incomplete message from the previous TCP
    // frame.
    if (incomplete) {
      lines = (incomplete + rawResponse).split("\n");
      incomplete = null;
    }
    while (rawMessage = lines.shift()) {
      message = irc.parseMessage(rawMessage);

      if (message === null && lines.length === 0) {
        // Maybe incomplete TCP frame?.
        incomplete = rawMessage;
      } else if (message === null) {
        // Complete frame, but cannot be parsed.
        console.log("Cannot parse message: " + rawMessage);
      } else {
        command = message.command.toLowerCase();

        if (connection.hasHandler(command)) {
          connection.emit(command, message);
        } else if (DefaultHandlers.hasOwnProperty(command)) {
          DefaultHandlers[command](message);
        } else if (window.console) {
          console.log(message);
        }
        connection.emit("all", command, message);
      }
    }
  };

  /** Transport to establish the connection to the irc server. It tries to
   * use native sockets if available, websockets in second place and polling
   * as the fallback strategy.
   *
   * @type {Object}
   * @private
   * @fieldOf irc.Connection#
   */
  var transport = (function () {
    // socket.io supported.
    if (window.io) {
      return new irc.WebSocket(server.proxy, handleMessage);
    }

    throw new Error("There's no transport to create a connection.");
  }());

  return irc.extend(connection, new irc.EventEmitter(), {

    /** Opens the connection to the irc server.
     * @param {Function} callback Invoked when the connection is established and
     *    the user is already in the irc server. Cannot be null.
     */
    open: function (callback) {
      transport.connect(function () {
        transport.send("NICK " + nick);
        transport.send("USER " + nick + " 8 * " + ":" + nick);

        initCallback = callback;
      });
    },

    /** Sens the specified message to the irc server. It does not need to end
     * with CRLF since it's automatically added.
     * @param {String} rawMessage Valid IRC message. Cannot be null or empty.
     */
    send: function (rawMessage) {
      transport.send(rawMessage);
    },

    /** Returns the server features supported on the active connection. Features
     * are defined by RPL_ISUPPORT specification:
     *
     * http://www.irc.org/tech_docs/005.html
     *
     * @return {Object} A map from server feature name to value, never null.
     */
    getFeatures: function () {
      return features;
    }
  });
};
