# IRC Client API

Lightweight JavaScript IRC client designed to provide a low-level access to a
irc server whenever possible.

Current features:

* Low-level event-based connection to the irc server.

* Support for different transports. The connection tries to resolve from most low-
level transport (aka native sockets) to higher level transport (websocket
protocol using socket.io).

* Easy-to-use IRC client.

Future features:

* TLS support

* Native sockets for android/ios using [cordova](https://cordova.apache.org/).

* More commands defined in RFC 1459 and RFC 2812.

# Usage

It is designed to run in a browser. The example project uses Express to render a
client which print messages to the browser's console. For further information
take a look at file ```views/index.html```.

# API

## irc.Transport(server:Object, messageCallback:Function)
## irc.WebSocket(server:Object, messageCallback:Function)

So far it is the only supported transport and provides a connection to the irc
server via websockets using socket.io and the [ircws](https://github.com/tjfontaine/node-ircws) proxy.

### Constructor parameters

**server.host**: IRC server host, used with native sockets support.

**server.port**: IRC server port number, used with native sockets support.

**server.proxy.host**: Websocket proxy host, used when no native sockets are
supported by the browser.

**server.proxy.port**: Websocket proxy port number, used with native sockets
support.

**messageCallback**: Callback that receives server messages. It takes the raw
server response as parameter.

## Methods

**send(rawMessage:String)**: sends the specified message to the server. It adds
the mandatory CRLF character to the end of line.

## irc.Connection(nick:String, server:Object)

Represents a connection to the IRC server. It chooses the proper transport and
allows to establish and keep a connection alive. It performs the basic handshake
and answers to pings.

### Constructor parameters

**nick**: nickname to use in the IRC server.

**server**: same as the server passed to ```irc.Transport``` constructor.

### Methods

**open(callback:Function)**: opens the connection to the irc server. The callback
is invoked once the user is logged into the server and it takes an error
as parameter.

**send(rawMessage:String)**: same as ```irc.Transport.send(rawMessage:String)```

**getFeatures():Object**: returns an object with features supported by the IRC
server. It is available after the connection is already initialized.

## irc.Client(nick:String, server:Object)

Lightweight client with basic operations.

### Constructor parameters

**nick**: same as the nickname parameter passed to ```irc.Connection```
constructor.

**server**: same as the server passed to ```irc.Transport``` constructor.

## Methods

**connect(callback:Function)**: connects the client to the irc server. The
callback is invoked when the connection is successfully established and it takes
an error as parameter.

**join(channelName:String[, key:String])**: joins into a channel and returns the
```Channel``` instance.

**quit(message:String)**: disconnects from the irc server and send the specified
exit message.

**part(channelName:String)**: leaves the specified channel.

**message(targetName:String, message:String)**: sends a message to either a user
or a channel.

**user(nick:String)**: returns the required user instance. It triggers a whois
on the specified user.

**getConnection():irc.Connection**: returns the connection instance.

## Events

**error**: emitted when the IRC server sends an error. The callback takes an
error object as parameter.

**quit**: emitted when any user quits the irc server. The callback takes an
object with the ```user``` that excited and the goodbye ```message```.
