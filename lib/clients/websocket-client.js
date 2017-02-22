const BaseClient = require('./base-client');
const _cloneDeep = require('lodash').cloneDeep;
const io = require('socket.io');
const urlParser = require('url');

class WebsocketClient extends BaseClient {

    __clientWillStart(bot, config) {

        const defaults = {
            namespace: "websocket",
            id: process.env.WEBSOCKET_ID
        };

        var config = Object.assign({}, defaults, config);

        super.__clientWillStart(bot, config)

        assert(config.id, "Websocket ID not provided")

        this.id = config.id
    }

    createConnectionHandler() {
        return (socket) => {
            const socketID = Object.keys(this.sockets).length;

            console.log(`new websocket connection ${socketID}`);
            socket.on('message', this.createMessageHandler(socket));

            this.sockets[socketID] = socket;
        };
    }

    createMessageHandler(socket) {
        return (data) => {
            const session = new Session(this.bot, data.user, this);
            session.socket = socket;

            this.bot.trigger('message_received', data, session);

            return session;
        };
    }

    send(session, text, attachment) {
        const message = {};

        if (text) {
            message.text = text;
        }

        if (attachment) {
            message.attachment = {
                type: attachment.type,
                url: attachment.url,
            };
        }

        session.socket.emit('message', message);
    }

    startTyping(session) {
        session.socket.emit('typing', {});
    }

    __setupSocketioServer() {

        this.ioServer = io(this.server);

        // const io = this.config;
        // this.sockets = {};
        // io.on('connection', this.createConnectionHandler());


        //     io.on('connection', (socket) => {
        //         console.log('new websocket connection');

        //         socket.on('message', (data) => {
        //             const session = {
        //                 user: data.user,
        //                 conversation: data.user,
        //                 account: data.user,
        //                 send(text) {
        //                     socket.emit('message', {
        //                         text,
        //                     });
        //                 },
        //             };

        //             bot.trigger('message_received', data, session);
        //         });
        //     });

        this.ioServer.on('connection', (socket) => {
            
            socket.join(SocketioBot.__getBotmasteruserId(socket));

            socket.on('message', (message) => {
                // just broadcast the message to other connected clients with same user id
                const botmasterUserId = SocketioBot.__getBotmasteruserId(socket);
                socket.broadcast.to(botmasterUserId).emit('own message', message);
                // console.log(JSON.stringify(socket.rooms, null, 2));
                const rawUpdate = message;
                try {
                    rawUpdate.socket = socket;
                } catch (err) {
                    err.message = `ERROR: "Expected JSON object but got '${typeof message}' ${message} instead"`;
                    return this.emit('error', err);
                }
                const update = this.__formatUpdate(rawUpdate, botmasterUserId);
                return this.__emitUpdate(update);
            });
        });
    }

    __formatUpdate(rawUpdate, botmasterUserId) {
        const timestamp = Math.floor(Date.now());

        const update = {
            raw: rawUpdate,
            sender: {
                id: botmasterUserId,
            },
            recipient: {
                id: this.id,
            },
            timestamp,
            message: {
                mid: `${this.id}.${botmasterUserId}.${String(timestamp)}.`,
                seq: null,
            },
        };

        if (rawUpdate.text) {
            update.message.text = rawUpdate.text;
        }

        if (rawUpdate.attachments) {
            update.message.attachments = rawUpdate.attachments;
        }

        return update;
    }

    __sendMessage(message) {
        const outgoingMessage = _cloneDeep(message);
        // just remove recipient from it, the rest (anything the developer wishes) goes through
        delete outgoingMessage.recipient;

        this.ioServer.to(message.recipient.id).send(outgoingMessage);

        return new Promise((resolve) => {
            const timestamp = Math.floor(Date.now());
            resolve({
                recipient_id: message.recipient.id,
                message_id: `${this.id}.${message.recipient.id}.${String(timestamp)}`,
            });
        });
    }
}

module.exports = WebsocketClient;