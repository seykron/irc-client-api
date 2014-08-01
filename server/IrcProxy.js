/** Irc proxy that listen for connections on the specified HTTP server.
 *
 * Adapted from: https://github.com/tjfontaine/node-ircws
 *
 * @param {Object} server Valid HTTP server instance. Cannot be null.
 * @param {String} config.ircHost Address of the IRC server. Cannot be null.
 * @param {Number} config.ircPort Irc server port number. Cannot be null.
 * @param {String} config.transport Transport used to accept client connections.
 *    It can be 'socket.io' or 'ws' (WebSocket library). Default is WebSocket.
 * @param {Number} [config.reconnectTime] Reconnection time, in seconds. Default
 *    is 15 seconds.
 * @constructor
 */
module.exports = function IrcProxy(server, config) {

  /** Default transport if it is not specified in the configuration.
   * @constant
   * @private
   * @fieldOf IrcProxy#
   */
  var DEFAULT_TRANSPORT = "ws";

  /** Node's domain API.
   * @type {Object}
   * @private
   * @fieldOf IrcProxy#
   */
  var dns = require('dns');

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
  var reconnectTime = config.reconnectTime || 15 * 1000;

  /** Mapping from client ips to connection timestamp, used to drop connection
   * attemps in a short time frame.
   * @type {Object[String => Number]}
   * @private
   * @fieldOf IrcProxy#
   */
  var lastConnection = {};

  /** Registers a new client and creates the connection to the irc server.
   *
   * @param {Object} Websocket client. Cannot be null.
   * @param {String} ip Client ip address. Cannot be null or empty.
   * @param {Function} closeCallback Invoked when the client connection must be
   *    closed because a proxy connection error. Cannot be null.
   * @private
   * @methodOf IrcProxy#
   */
  var registerClient = function (client, ip, closeCallback) {
    var time = lastConnection[ip];
    if (time !== undefined && (Date.now() - time) < reconnectTime) {
      console.log('client connecting too fast', ip, time, Date.now());
      client.send('ERROR :Trying to reconnect too fast.\r\n');
      closeCallback();
    } else {
      lastConnection[ip] = Date.now();
      console.log('client connected', ip);
      dns.reverse(ip, function (err, domains) {
        if (err) {
          connect(client, ip, ip);
          return;
        }
        var domain = domains[0];
        dns.resolve(domain, function (err, addresses) {
          if (err || addresses[0] !== ip) {
            connect(client, "186.136.117.240", "240-117-136-186.fibertel.com.ar");
            return;
          } else {
            connect(client, ip, domain);
          }
        });
      });
    }
  };

  /** Connects the specified client to the irc server.
   * @param {Object} Websocket client. Cannot be null.
   * @param {String} ip Client ip address. Cannot be null or empty.
   * @param {String} host Client host. Cannot be null or empty.
   * @private
   * @methodOf IrcProxy#
   */
  var connect = function (client, ip, host) {
    console.log('client connecting to irc', ip);

    var remote = tls.connect(config.ircPort, config.ircHost, function () {
      console.log('client connected to irc', ip);
    });

    remote.on('data', function (d) {
      if (client.readyState !== undefined && client.readyState == ws.CLOSED) {
        remote.end();
      } else {
        //console.log(d.toString('utf-8'));
        client.send(d.toString('utf-8'));
      }
    });

    remote.on('end', function () {
      console.log('irc server hungup', ip);

      if(client.close)
        client.close();
      else
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

    client.on('end', function () {
      console.log('client hungup', ip);
      remote.end();
    });

    client.on('disconnect', function () {
      console.log('client hungup', ip);
      remote.end();
    });
  };

  /** Supported transports for client connections.
   * @namespace
   * @private
   * @fieldOf IrcProxy#
   */
  var Transports = {
    /** Uses socket.io to receive client connections.
     */
    "socket.io": function () {
      var io = require('socket.io')(server);
      io.set('log level', 1);
      io.sockets.on('connection', function (client) {
        registerClient(client, client.handshake.address.address, client.close);
      });
    },

    /** Uses the WebSocket library.
     */
    "ws": function () {
      var ws = require('ws');
      var wsserver = new ws.Server({
        server: server,
        verifyClient: function (info) {
          return true;
        },
      }).on('connection', function (client) {
        registerClient(client, client._socket.remoteAddress, client.disconnect);
      });
    }
  };

  /** Constructor method.
   * @private
   */
  (function __init() {
    var maxAge = 5 * reconnectTime;

    setInterval(function () {
      var now = Date.now();
      var ip;

      for (ip in lastConnection) {
        if ((now - lastConnection[ip]) > maxAge) {
          delete lastConnection[ip];
        }
      }
    }, maxAge);
  }());

  return {
    /** Enables this proxy in the configured HTTP server.
     */
    attach: function () {
      var handler = Transports[config.transport || DEFAULT_TRANSPORT];
      handler();
    }
  };
};
