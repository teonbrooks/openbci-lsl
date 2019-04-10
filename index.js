require('./text-polyfill');
const { Observable } = require('rxjs');

const lsl = require('node-lsl');
const { Cyton } = require("openbci-observable");


async function connect() {
    let client = await new Cyton({ verbose: true });
    await client.connect();
    await client.start();

    return client;
}

function streamLsl(client) {
    console.log('LSL: Creating Stream...');

    const info = client.getInfo();
    const n_channels = info.numberOfChannels;
    const sfreq = info.sampleRate;
    const name = info.boardType

    const info = lsl.create_streaminfo("OpenBCI", "EEG", n_channels, sfreq, lsl.channel_format_t.cft_float32, name);
    const desc = lsl.get_desc(info);
    lsl.append_child_value(desc, "manufacturer", "OpenBCI");
    const channels = lsl.append_child(desc, "channels");
    for (let i = 0; i < 5; i++) {
        const channel = lsl.append_child(channels, "channel");
        lsl.append_child_value(channel, "label", channelNames[i]);
        lsl.append_child_value(channel, "unit", "microvolts");
        lsl.append_child_value(channel, "type", "EEG");
    }

    const outlet = lsl.create_outlet(info, 0, 360);
    let sampleCounter = 0;

    Observable.from(client)
        .finally(() => {
            lsl.lsl_destroy_outlet(outlet);
            clearInterval(keepaliveTimer);
        })
        .subscribe(sample => {
            const sampleData = new lsl.FloatArray(sample.channelData);
            lsl.push_sample_ft(outlet, sampleData, lsl.local_clock());
            sampleCounter++;
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`LSL: Sent ${sampleCounter} samples`);;
        });
}
