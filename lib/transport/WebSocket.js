window.irc = window.irc || {};

/** This transport provides a connection via websockets and polling using
 * socket.io.
 *
 * @param {Object} server Server information. Cannot be null.
 * @param {String} server.host Address of the IRC host. Cannot be null or empty.
 * @param {Number} server.port Port number to connect to. Cannot be null.
 * @param {Boolean} server.tls Indicates whether to use a secure connection
 *    to the irc server or not. Default if false.
 * @param {Object} server.proxy IRC proxy information to use when the browser
 *    does not support native sockets. Cannot be null.
 * @param {String} server.proxy.host Address of the IRC proxy host. Cannot be
 *    null or empty.
 * @param {Number} server.proxy.port Port number to connect to. Cannot be null.
 *
 * @constructor
 */
irc.WebSocket = function (server, messageCallback) {

  /** Open websocket connection, never null after connect().
   * @type {WebSocket}
   * @private
   * @fieldOf irc.WebSocket#
   */
  var socket;

  return {

    /** Connects this transport the irc server.
     * @param {Function} callback Invoked when the connection is established or
     *    failed. It takes an error as parameter. Cannot be null.
     */
    connect: function (callback) {
      var hasError = false;

      socket = io("http://" + server.proxy.host + ":" + server.proxy.port);

      socket.on("message", messageCallback);
      socket.on("ready", callback);
      socket.on("connect", function () {
        if (!hasError) {
          socket.emit("proxy", server);
        }
      });
      socket.on("error", function (err) {
        hasError = true;
        callback(err, null);
      });
    },

    /** Sends a message and ensures it ends with CRLF. Messages are sent always
     * on the next processor tick.
     *
     * @param {String} data Message to send. Cannot be null or empty.
     */
    send: function (data) {
      socket.emit("message", data + "\n");
    }
  };
};
