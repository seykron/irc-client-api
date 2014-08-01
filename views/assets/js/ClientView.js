window.irc = window.irc || {};

/** Very basic irc client UI.
 * @param {Element} container Client container. Cannot be null.
 * @param {irc.Client} client Irc client. Cannot be null.
 * @param {String[]} [options.autoJoin] List of channels to join.
 * @constructor
 */
irc.ClientView = function (container, client, options) {

  /** Template for new channels.
   * @type {String}
   * @private
   * @fieldOf irc.ClientView#
   */
  var channelTemplate = jQuery(".js-buffer-template").html();

  /** List of channels to join on start up.
   * @type {String[]}
   * @private
   * @fieldOf irc.ClientView#
   */
  var autoJoin = options.autoJoin || [];

  /** Appends a line to the buffer.
   * @param {Element} buffer Element to append the message. Cannot be null.
   * @param {String} message Message to append. Cannot be null.
   * @private
   * @methodOf irc.ClientView#
   */
  var write = function (buffer, message) {
    buffer.append(message + "<br>");
  };

  /** Joins to the specified channel and sets up the buffer.
   * @param {String} channelName Name of the channel to join. Cannot be null or
   *    empty.
   * @private
   * @methodOf irc.ClientView#
   */
  var join = function (channelName) {
    var channelContainer = jQuery(channelTemplate);
    var buffer = channelContainer.find(".js-buffer");
    var messageField = channelContainer.find("input[name='message']");
    var channel = client.join(channelName);

    container.append(channelContainer);

    channel.on("ready", function () {
      write(buffer, "Joined to " + channelName);
    });
    channel.on("message", function (message) {
      write(buffer, "[" + message.user.nick + "]" + ": " + message.text);
    });
    channel.on("part", function (info) {
      write(buffer, "User " + info.user.nick + " left (" + info.message + ")");
    });
    channel.on("info", function (field, value) {
      write(buffer, field + ": " + value);
    });
    messageField.keyup(function (event) {
      var message = messageField.val();

      if (event.which == 13) {
        write(buffer, "[You]: " + message);
        channel.message(message);
        messageField.val("");
      }
    });
  };

  /** Initializes event listeners.
   * @private
   * @methodOf irc.ClientView#
   */
  var initEventListeners = function() {
    autoJoin.forEach(function (channel) {
      join(channel);
    });
    client.on("quit", function (info) {
      console.log("User " + info.user.nick + " quits (" + info.message + ")");
    });
    client.on("notice", function (notice) {
      console.log("NOTICE to " + notice.target + ": " + notice.text);
    });
    client.on("error", function (error) {
      console.log(error);
    });
  };

  return {
    /** Renders the view, initializes event listeners and perform autojoins.
     */
    render: function () {
      initEventListeners();
    }
  };
};
