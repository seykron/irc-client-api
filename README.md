# IRC Client API

Lightweight JavaScript IRC client designed to provide a low-level access to a
irc server whenever possible.

Current features:

* Low-level event-based connection to the irc server.

* Support for different transports. The connection tries to resolve from the
lower-level transport (aka native sockets) to higher level transport available
(websocket protocol using socket.io).

* Easy-to-use IRC client.

* TLS support

Future features:

* Native sockets for android/ios using [cordova](https://cordova.apache.org/).

* More commands defined in RFC 1459 and RFC 2812.

# Usage

It is designed to run in a browser. The example project uses Express to render a
client which print messages to the browser's console. For further information
take a look at file ```views/index.html```.

# API

## irc.Transport(server:Object, messageCallback:Function)
## irc.WebSocket(server:Object, messageCallback:Function)

So far it is the only supported transport and it provides a connection to the
irc server via websockets using socket.io and a proxy server that routes all
traffic from the irc server to the websocket.

### Constructor parameters

**server.host:String** IRC server host, used with native sockets support.

**server.port:Number** IRC server port number, used with native sockets
support.

**[server.tls:Boolean]** Indicates whether to use a TLS connection to the irc
server or not. Default is false.

**server.proxy.host:String** Websocket proxy host, used when no native sockets
are supported by the browser.

**server.proxy.port:Number** Websocket proxy port number, used with native
sockets support.

**messageCallback:Function** Callback that receives server messages. It takes
the raw server response as parameter.

### Methods

**send(rawMessage:String)** sends the specified message to the server. It adds
the mandatory CRLF character to the end of line.

## irc.Connection(nick:String, server:Object)

Represents a connection to the IRC server. It chooses the proper transport and
allows to establish and keep a connection alive. It performs the basic handshake
and answers to pings.

### Constructor parameters

**nick:String** nickname to use in the IRC server.

**server:Object** same as the server passed to ```irc.Transport``` constructor.

### Methods

**open(callback:Function)** opens the connection to the irc server. The callback
is invoked once the user is logged into the server and it takes an error
as parameter.

**send(rawMessage:String)** same as ```irc.Transport.send(rawMessage:String)```

**getFeatures():Object**: returns an object with features supported by the IRC
server. It is available after the connection is already initialized.

## irc.Client(nick:String, server:Object)

Lightweight client with support for basic IRC commands.

### Constructor parameters

**nick:String** same as the nickname parameter passed to ```irc.Connection```
constructor.

**server:Object** same as the server passed to ```irc.Transport``` constructor.

### Methods

**connect(callback:Function)** connects the client to the irc server. The
callback is invoked when the connection is successfully established and it takes
an error as parameter.

**join(channelName:String[, key:String]):Channel** joins into a channel and
returns the ```Channel``` instance.

**quit(message:String)** disconnects from the irc server and send the specified
exit message.

**part(channelName:String)** leaves the specified channel.

**message(targetName:String, message:String)** sends a message to either a user
or a channel.

**user(nick:String):User** returns the required ```User``` instance. It triggers
a WHOIS on the specified user.

**getConnection():irc.Connection** returns the connection instance.

### Events

**error** emitted when the IRC server sends an error. The callback takes an
```error:Error``` object as parameter.

**quit** emitted when any user quits the irc server. The callback takes an
object with the ```user:User``` that excited and the goodbye
```message:String``` as parameter.

**mode** emitted when the client receives a MODE reply from either a channel or
a user. The callback takes an object with the ```target:String``` (channel or
user) and ```modes:String``` as parameter.

**topic** emitted when the client receives a TOPIC reply for a channel. The
callback takes an object with the ```channelName:String``` and the
```topic:String``` as parameter.

**message** emitted when the client receives a message from a channel or another
user. The callback takes an object with the ```user:User``` that sent the
message, the ```target:String``` (channel or user) and the message
```text:String``` as parameter.

**notice** emitted when the client receives a NOTICE from the irc server or a
user. The callback takes an object with the notice message ```target:String```
(channel or user) and the message ```text:String``` as parameter.

## irc.Channel(channelName:String)

Represents a IRC channel and provides an easy access to operations on the
channel.

### Constructor parameters

**channelName:String** Name of the channel. Cannot be null or empty.

### Properties

**name:String** Channel name. It is never null or empty.

### Methods

**names():String[]** Returns the list of user names in the channel. It is
available after the ```ready``` event.

**part()** Leaves the channel.

**message(text:String)** Sends a message to this channel. The text cannot be
null or empty.

### Events

**join** emitted when a user joins the channel. The callback takes the
```user:User``` as parameter.

**part** emitted when a user leaves the channel. The callback takes an object
with the leaving ```user:User``` and quit ```message:String``` as parameter.

**message** emitted when someone sends a message to the channel. The callback
takes an object with the source ```user:User``` and the message
```text:String``` as parameter.

**ready** emitted after joining the channel when the irc server successfully
joined the client to the channel.

**info** emitted when the irc server provides channel information (for example,
the topic or channel modes). The callback takes the information
```field:String``` name and the ```value:String``` as parameters.

## irc.User(nick:String)

Represents a user in the irc server. Some properties are available only after
commands that provide the related information. For instance, the list of
channels is only available after a WHOIS.

### Constructor parameters

**nick:String** User unique nickname. Cannot be null or empty.

### Properties

**nick:String** User unique nickname. It is never null or empty.

**channels:String[]** List of channels the user is joined to. It is never null.

**away:Boolean** Indicates whether the user is away or not.

### Methods

**message(text:String)** Sends a message to this user. The text cannot be
null or empty.

**whois()** Asks information about this user. It emits the ```whois``` event.

### Events

**message** emitted when the user sends a private message to the client. The
callback takes the message ```text:String``` as parameter.

**whois** emitted when a WHOIS command on this user finished. The callback takes
the ```user:User``` as parameter.

**error** emitted when there's an error related to this user. For instance,
it is emitted when the user does not exist in the server. It takes an
```error:Error``` as parameter.

**away** emitted when the user sets or removes the away status. It takes the
away ```message:String``` as parameter.
