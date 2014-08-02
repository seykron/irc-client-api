/** Irc proxy that listen for connections on the specified HTTP server.
 *
 * Adapted from: https://github.com/tjfontaine/node-ircws
 *
 * @param {Object} server Valid HTTP server instance. Cannot be null.
 * @param {Number} [config.reconnectTime] Reconnection time, in seconds. Default
 *    is 15 seconds.
 * @constructor
 */
module.exports = function IrcProxy(server, config) {

  /** Node's network API.
   * @type {Object}
   * @private
   * @fieldOf IrcProxy#
   */
  var net = require("net");

  /** Node's TLS connection API.
   * @type {Object}
   * @private
   * @fieldOf IrcProxy#
   */
  var tls = require('tls');

  /** Reconnection time, in milliseconds.
   * @type {Number}
   * @private
   * @fieldOf IrcProxy#
   */
  var reconnectTime = (config && config.reconnectTime) || 15 * 1000;

  /** Mapping from client ips to connection timestamp, used to drop connection
   * attemps in a short time frame.
   * @type {Object[String => Number]}
   * @private
   * @fieldOf IrcProxy#
   */
  var activeConnections = {};

  /** Registers a new client and creates the connection to the irc server.
   *
   * @param {Object} Websocket client. Cannot be null.
   * @param {String} ip Client ip address. Cannot be null or empty.
   * @param {Function} errorCallback Invoked when there's an error registering
   *    the client. Cannot be null.
   * @private
   * @methodOf IrcProxy#
   */
  var registerClient = function (client, ip, errorCallback) {
    var time = activeConnections[ip];
    if (time !== undefined && (Date.now() - time) < reconnectTime) {
      console.log('client connecting too fast', ip, time, Date.now());
      client.send("ERROR: Trying to reconnect too fast\r\n");

      errorCallback(new Error("Trying to reconnect too fast"));
    } else {
      activeConnections[ip] = Date.now();
      console.log('client connected', ip);
    }
  };

  /** Connects the specified client to the irc server.
   * @param {Object} Websocket client. Cannot be null.
   * @param {String} ip Client ip address. Cannot be null or empty.
   * @private
   * @methodOf IrcProxy#
   */
  var connect = function (client, ip, serverInfo) {
    var remote;

    console.log('client connecting to irc', ip);

    if (serverInfo.tls) {
      remote = tls.connect(serverInfo.port, serverInfo.host, function () {
        console.log('client connected to irc (TLS)', ip);
      });
    } else {
      remote = net.connect(serverInfo.port, serverInfo.host, function () {
        console.log('client connected to irc', ip);
      });
    }

    remote.on('data', function (data) {
      if (client.readyState !== undefined && client.readyState == ws.CLOSED) {
        remote.end();
      } else {
        client.send(data.toString('utf-8'));
      }
    });

    remote.on('end', function () {
      console.log('irc server hungup', ip);
      client.disconnect();
    });

    remote.on('error', function (err) {
      console.log('irc server connection error', err, ip);
    });

    client.on('message', function (msg) {
      if (remote.writable) {
        remote.write(msg);
      }
    });

    client.on('disconnect', function () {
      console.log('client hungup', ip);
      remote.end();
    });
  };

  /** Prepares socket.io to receive client connections.
   * @private
   * @methodOf IrcProxy#
   */
  var setupTransport = function () {
    var io = require('socket.io')(server);

    io.sockets.on('connection', function (socket) {
      var ip = socket.handshake.address.address;

      socket.on("proxy", function (serverInfo) {
        connect(socket, ip, serverInfo);
        socket.emit("ready");
      });
      registerClient(socket, ip, socket.disconnect);
    });
  };

  /** Constructor method.
   * @private
   */
  (function __init() {
    var maxAge = 5 * reconnectTime;

    // Drops dead connections.
    setInterval(function () {
      var now = Date.now();
      var ip;

      for (ip in activeConnections) {
        if ((now - activeConnections[ip]) > maxAge) {
          delete activeConnections[ip];
        }
      }
    }, maxAge);
  }());

  return {
    /** Enables this proxy in the configured HTTP server.
     */
    attach: function () {
      setupTransport();
    }
  };
};
