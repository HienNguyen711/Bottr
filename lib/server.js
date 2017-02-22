const Bot = require('./bot');
const WebsocketClient = require('./clients/websocket-client');

class Server {
    constructor() {
        this.namespaces = {};
    }

    use(namespaceOrBot, bot) {
        if (bot) {
            this.namespaces[namespaceOrBot] = bot;
        } else {
            this.namespaces['/'] = namespaceOrBot;
        }
    }

    listen(port) {
        const app = require('express')();
        const server = require('http').Server(app);

        server.listen(port);

        for (const path in this.namespaces) {
            const bot = this.namespaces[path];
            // - Don't enable by default, take a page out of Botmaster
            // bot.use(new WebsocketClient(io.of(path)));
            app.use(path, bot.router);
        }

        return server;
    }
}

module.exports = Server;