const CronJob = require("cron").CronJob;
const Discord = require("discord.js");
const Constants = require("../helpers/constants");

module.exports = class {
    constructor (client) {
        this.client = client;
    }

    async run () {

        this.client.user.setActivity("+help | manage-invite.xyz");
        setInterval(() => {
            this.client.user.setActivity("+help | manage-invite.xyz");
        }, 60000*60);
        this.client.log("Shard #"+this.client.shard.ids[0]+" has started.", "log");
        this.client.functions.postTopStats(this.client);

        if (!process.argv.includes("--uncache")) await this.client.wait(1000);
        const invites = {};
        const startAt = Date.now();
        this.client.fetching = true;

        const premiumGuildsID = await this.client.database.fetchPremiumGuildIDs();
        this.client.log(`Shard #${this.client.shard.ids[0]} is ready!`);
        await this.client.functions.asyncForEach(this.client.guilds.cache.array(), async (guild) => {
            if (premiumGuildsID.includes(guild.id)){
                const member = await guild.members.fetch(this.client.user.id).catch(() => {});
                const i = process.argv.includes("--uncache") ? null : (member.hasPermission("MANAGE_GUILD") ? await guild.fetchInvites().catch(() => {}) : null);
                invites[guild.id] = i || null;
            }
        });
        this.client.invitations = invites;
        this.client.fetched = true;
        this.client.fetching = false;
        if (this.client.shard.ids.includes(0)) console.log("=================================================");
        console.log("\x1b[32m%s\x1b[0m", `SHARD [${this.client.shard.ids[0]}]`, "\x1b[0m", `Invites fetched in ${Date.now() - startAt} ms.`);
        console.log("=================================================");
        if (this.client.shard.ids.includes(this.client.shard.count-1)){
            console.log("Ready. Logged as "+this.client.user.tag+". Some stats:\n");
            this.client.shard.broadcastEval(() => {
                console.log("\x1b[32m%s\x1b[0m", `SHARD [${this.shard.ids[0]}]`, "\x1b[0m", `Serving ${this.users.cache.size} users in ${this.guilds.cache.size} servers.`);
            });
        }
        this.client.ipc.load(this.client);
        if (this.client.shard.ids.includes(0) && !this.client.spawned){
            new CronJob("0 5 0 * * *", async () => {
                // tous les abonnements qui ont expiré il y a trois jours au moins
                this.client.database.fetchNewlyCancelledPayments().then(async (paymentsData) => {
                    console.log(`Envoi de ${paymentsData.length} notifications`);
                    paymentsData.forEach(async (paymentData) => {
                        const user = await this.client.users.fetch(paymentData.payerDiscordID);
                        const guildNames = await this.client.shard.broadcastEval(`
                            let guild = this.guilds.cache.get('${paymentData.guildID}');
                            if(guild) guild.name;
                        `);
                        const guildNameFound = guildNames.find((r) => r);
                        if (!guildNameFound) {
                            return this.client.database.setPaymentRemindSent({
                                paymentID: paymentData.paymentID, 
                                subID: paymentData.subID,
                                success: false,
                                kicked: true
                            });
                        }
                        const beg = paymentData.subLabel === "Trial Version" ? "Your trial period" : "Your premium subscription";
                        const embed = new Discord.MessageEmbed()
                            .setAuthor(`Hello, ${user.username}`)
                            .setDescription(`${beg} for **${guildNameFound}** expires in 72 hours! Click [here](https://dash.manage-invite.xyz/manage/${paymentData.guildID}/createsub) to continue to use the bot, the price is $2 per month.`)
                            .setColor(Constants.Embed.COLOR)
                            .setFooter(Constants.Embed.FOOTER);
                        const send = () => new Promise((resolve) => user.send(embed).then(resolve(true)).catch(resolve(false)));
                        this.client.database.setPaymentRemindSent({
                            paymentID: paymentData.paymentID, 
                            subID: paymentData.subID,
                            success: await send(),
                            kicked: false
                        });
                    });
                });
            }, null, true, "America/Los_Angeles");
        }

        new CronJob("0 */15 * * * *", async () => {
            if (this.client.fetched){
                const guildsToFetch = this.client.guilds.cache.filter((guild) => !this.client.invitations[guild.id]).array();
                this.client.log(`${guildsToFetch.length} guilds need to be fetched`);
                await this.client.functions.asyncForEach(guildsToFetch, async (guild) => {
                    const member = await guild.members.fetch(this.client.user.id).catch(() => {});
                    const i = process.argv.includes("--uncache") ? null : (member.hasPermission("MANAGE_GUILD") ? await guild.fetchInvites().catch(() => {}) : null);
                    this.client.invitations[guild.id] = i || null;
                });
                this.client.fetched = true;
            }
        }, null, true, "America/Los_Angeles");

    }
};

