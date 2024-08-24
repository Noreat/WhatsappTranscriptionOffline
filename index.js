const wa = require('@open-wa/wa-automate');
const mime = require('mime-types');
const fs = require('fs').promises;
const { exec } = require("child_process");
const util = require('util');
const execAsync = util.promisify(exec);
require('dotenv').config();

const path_mp3 = process.env.PATH_MP3 || '.';
const sessionDataPath = process.env.PATH_SESSION || './';
const groups = process.env.GROUPS || '';
const allowedGroups = groups.split(',').map(item => item.trim());
const ownChatID = '';

wa.create({
    useChrome: true,
    sessionId: "WhatsAppTranscription",
    multiDevice: true, // required to enable multiDevice support
    authTimeout: 60, // wait only 60 seconds to get a connection with the host account device
    blockCrashLogs: true,
    disableSpins: true,
    headless: true,
    hostNotificationLang: 'PT_BR',
    logConsole: true,
    popup: true,
    qrTimeout: 0, // 0 means it will wait forever for you to scan the qr code
    sessionDataPath,
}).then(client => start(client));

async function start(client) {
    client.onAnyMessage(async message => {
        try {
            const shouldTranscribe = (
                !message.isGroupMsg || 
                allowedGroups.includes(message.chatId) ||
                allowedGroups.includes('*')
            );

            //un-comment the following block to log the group name and group ID
            // if(message.isGroupMsg){
            //     const groupName = message.chat?.contact?.name || '';
            //     const groupId= message.chatId;
            //     console.log(`Group name: ${groupName} | Group ID: ${groupId}`)
            // }

            if (shouldTranscribe && message.mimetype && message.mimetype.includes("audio")) {
                const d = new Date(message.t * 1000).toISOString();
                const orig = message.notifyName;
                const dest = message.chat?.contact?.name || '';
                const isGroup = message.isGroupMsg ? "(GROUP)" : "";
                const isAudio = "(AUDIO)";
                console.log(`${d}|${orig}|${dest}${isGroup}|${msg}${isAudio}| chatID: ${message.chatId} | messageID: message.id`);

                const suffix = Math.floor(Math.random() * 1000);
                const extension = mime.extension(message.mimetype);
                const filename = `${path_mp3}/${message.t}-${suffix}.${extension}`;
                const wavFilename = `${filename}.wav`;
                const textFilename = `${wavFilename}.txt`;
                
                const mediaData = await wa.decryptMedia(message);

                await fs.writeFile(filename, mediaData);

                await execAsync(`ffmpeg -v 0 -i ${filename} -ar 16000 ${wavFilename}`);
                await execAsync(`./whisper -otxt --model ggml-small.bin -l de ${wavFilename}`);
                
                const transcription = await fs.readFile(textFilename, 'utf8');
                await client.reply(message.chatId, `🗣️ \`\`\`${transcription}\`\`\``, message.id);
//              await client.forwardMessages('xxxxx@c.us,"messageId",true)
 //               await client.sendText(${ownChatID}, message.sender.pushname+' said:-');//will send name of the message sender
 //               await client.forwardMessages(${ownChatID},message.id,true);

/*
                //Beispiel zum weiterleiten von Nachrichten
                function start(client) {
                    client.onMessage(async message => { // This function will be called when any message is detected
                    console.log(message.from);//Use this for finding the sender or reciever id
                    console.log(message.sender.pushname); // will output sender name in console
                    console.log(message);
                    if (message.from == 'xxx82@g.us') {//enter the sender ID in this if condition for example '919328286140-1564742282@g.us'
                        await client.sendText('xx701@g.us', message.sender.pushname+' said:-');//will send name of the message sender
                        await client.forwardMessages('xx701@g.us',message.id,true);// This line will forward message , Sender -> reciever xx701@g.us is recieve 
                    }
                });
*/

                await fs.unlink(filename);
                await fs.unlink(wavFilename);
                await fs.unlink(textFilename);
            }
        } catch (error) {
            console.error(`An error occurred: ${error.message}`);
        }
    });
}
