const websocket = require('ws-reconnect');
const axios = require('axios');

const ws = new websocket('wss://wsn.dota2.net/wsn/');

const API = 'https://market.csgo.com/api';
const token = '-';
const itemId = '-';
const classId = '-';
const instanceId = '-';
const myLimit = 2777778;

const getNow = () => new Date().toTimeString().split(' ')[0];

const setPrice = (newPrice) => {
    axios.post(`${API}/SetPrice/${itemId}/${newPrice}/?key=${token}`).then(({ data: { result, price } }) => {
        result === 'too_often'
            ? console.warn('Не удалось поменять цену, слишком частые запросы')
            : console.log(getNow(), `Моя новая цена ${price}₽`);
    });
};

const updateOffer = () => {
    axios
        .get(`${API}/BestSellOffer/${classId}_${instanceId}/?key=${token}`)
        .then(({ data: { best_offer: lowPrice } }) => {
            console.log(getNow(), `Лучшее предложение на тп ${lowPrice / 100}₽`);

            if (lowPrice > myLimit) {
                setPrice(lowPrice - 1);
            } else {
                console.warn(`Цена лучшего предложения ${lowPrice / 100}₽ ниже нашего лимита в ${myLimit / 100}₽`);
                axios.get(`${API}/v2/items?key=${token}`).then(({ data: { items } }) => {
                    console.log(`Пробуем установить свой минимум равный ${myLimit / 100}₽`);
                    items[0].price > myLimit / 100
                        ? setPrice(myLimit)
                        : console.log(`Моя цена уже минимальная - ${myLimit / 100}₽.`);
                });
            }
        })
        .catch((err) => console.error(err));
};

ws.start();

const connectWs = () => {
    console.info('Пробуем установить соединение');

    axios.post(`${API}/PingPong/?key=${token}`);

    axios.post(`${API}/GetWSAuth/?key=${token}`).then(({ data: { success, wsAuth } }) => {
        if (!success) {
            console.error('Ошибка соединения! Повторим через 60 сек');
            return setTimeout(() => {
                connectWs();
            }, 60 * 6000);
        }
        ws.socket.send(wsAuth, (err) => {
            if (err) {
                console.error(err);
                return setTimeout(() => {
                    connectWs();
                }, 60 * 6000);
            } else {
                console.info('Соединение успешно установлено');

                updateOffer();

                ws.socket.send('newitems_go', (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
            }
        });
    });
};

setInterval(() => {
    ws.socket.send('ping', (err) => {
        if (err) {
            connectWs();
            console.error(err);
        }
    });
}, 40 * 1000);

setInterval(() => {
    axios.post(`${API}/v2/ping/?key=${token}`);
}, 180 * 1000);

ws.on('reconnect', () => {
    console.info('Производим переподключение');
});

ws.on('connect', () => {
    connectWs();
});

ws.on('destroyed', (e) => {
    console.info('Соединение прервано', e);
});

ws.on('message', (message) => {
    try {
        const { type, data } = JSON.parse(message);

        if (type === 'newitems_go') {
            const { i_classid, i_instanceid, ui_id } = JSON.parse(data);

            if (i_classid === classId && i_instanceid === instanceId && ui_id !== itemId) updateOffer();
        }
    } catch {
        console.info(message);
    }
});
