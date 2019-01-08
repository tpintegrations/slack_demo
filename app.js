const express = require('express');
const bodyParser = require('body-parser');
var request = require('request');
const { Pool } = require('pg')

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    database:"postgres",
    password:"Eniyan007!",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
});



const app = express();

const clientId = '515090184532.515258122066';
const clientSecret = '9435d88cbb43918bc2012a65324e560a';
var short_url;
var action;
var attachments = [];

//parse the body of the request
app.use(bodyParser());

//attach headers 
app.use((req,res,next)=>{
    res.setHeader("Access-Control-Allow-Origin","*");
    next();
})

//callback end point to get the code.
app.get("/oauth/callback",(req,res)=>{
    console.log(req.query.code);

    //request for the access token.
    request({
        url: 'https://slack.com/api/oauth.access', //URL to hit
        qs: {code: req.query.code, client_id: clientId, client_secret: clientSecret}, //Query string data
        method: 'GET',

    }, async function (error, response, body) {
        if (error) {
            console.log(error);
        } else {
            body = JSON.parse(body);

            console.log(body);

            // response is sent
            res.send("<html>thank you for installing</html>");

            //User Access is stored in db
            await pool.connect()
            .then(client => {
                return client.query('insert into user_acc_token values($1,$2,$3)', [body.user_id,body.access_token,body.team_id])
                .then(res => {
                    client.release()
                    console.log(res.rows[0])
                })
                .catch(e => {
                    client.release()
                    console.log(e.stack)
                })
            })

            //bot access token is stored in ythe db
            await pool.connect()
            .then(client => {
                return client.query('insert into bot_acc_token values($1,$2,$3)', [body.bot.bot_user_id,body.bot.bot_access_token,body.team_id])
                .then(res => {
                    client.release()
                    console.log(res.rows[0])
                })
                .catch(e => {
                    client.release()
                    console.log(e.stack)
                })
            })
        }
    })
})

//end point for the slash command
app.post("/command/test",(req,res)=>{
    
    res.send({
        "text":"Hey there",
        "attachments":[
            {
                author_name:"Poll Bot",
                title:"Assert Request",
                text:"The user has requested for a assert",
                callback_id: "leave_request",
                color:"#2d9ee0",
                actions: [
                    {
                        "name": "accept",
                        "text": "Accept",
                        "type": "button",
                        "value": "Accepted",
                        "style":"good"
                    },
                    {
                        "name": "reject",
                        "text": "Reject",
                        "type": "button",
                        "value": "Rejected",
                        "style":"danger"
                    }
                ]

            }
        ],
        response_type:"in_channel"
    });
})


//news command

app.post("/command/news",async (req,res)=>{
    attachments = []
    console.log(req.body);
    if(req.body.text === ''){
        await new Promise((resolve,reject)=>{
            request({
                "url":"https://newsapi.org/v2/top-headlines?country=IN&sortBy=publishedAt&apiKey=dde18b9de8f048e5b0dc61f175dda4d2",
                method:"GET"
            },(err,res,body)=>{
                if(err){
                    console.log(err);
                    reject(err);
                }
                else{
                    body = JSON.parse(body);
                    var articles = body.articles;
                    for(var article_index in articles){
                        article = articles[article_index];
                        attachment = {
                            "pre_text" : "News Bot",
                            "title" : article.title,
                            "title_link" : article.url,
                            "image_url" : article.urlToImage,
                            "fields" : [
                                {
                                    "title" : "Date",
                                    "value" : article.publishedAt
                                }
                            ],
                            "text": article.content
                        }
                        attachments.push(attachment);
                    }
                    resolve(attachments);
                }
            })
        })
        .then(attachments=>{
            console.log(attachments)
        })
        .catch(err=>{
            console.log(err);
        })
    }
    else{
        
        var topic = req.body.text;
        console.log(topic);
    
        //news api

        await new Promise((resolve,reject)=>{
            request({
                "url":"https://newsapi.org/v2/top-headlines?q=" + topic + "&sortBy=publishedAt&apiKey=dde18b9de8f048e5b0dc61f175dda4d2",
                method:"GET"
            },(err,res,body)=>{
                if(err){
                    console.log(err)
                    reject(err);
                }
                else{
                    body = JSON.parse(body);
                    console.log(body);
                    var articles = body.articles;
                    for(var article_index in articles){
                        article = articles[article_index];
                        attachment = {
                            "pre_text" : "News Bot",
                            "title" : article.title,
                            "title_link" : article.url,
                            "image_url" : article.urlToImage,
                            "fields" : [
                                {
                                    "title" : "Date",
                                    "value" : article.publishedAt
                                }
                            ],
                            "text": article.content
                        }
                        attachments.push(attachment);
                    }
                    resolve(attachments);
                }
            })
        })
        .then(attachments=>{
            console.log(attachments);
        })
        .catch(err=>{
            console.log(err);
        })

    }

    res.send({
        "text" : "here is the news for today",
        "attachments" : attachments,
        "in_channel":true
    })
})

//end point for event subscriptions
app.post("/slack",async (req,res)=>{
    res.status(200).send({"challenge":req.body.challenge});
    var event = req.body.event;
    console.log(event);
    if(event.type === "message"){
        if(event.subtype === 'bot_message' || event.subtype === 'message_changed' ){
            return;
        }
        await pool.connect()
        .then(async client => {
            await client.query("select access_token from user_acc_token where workspace like '"+req.body.team_id+"'")
            .then(async res => {
                client.release()
                console.log(res.rows[0])
                access_token = res.rows[0].access_token;
                message  = event.text;
    
                var text = "";
    
                if(event.channel_type === 'im'){

                    if(message === 'hi'){
                        text = "Hi <@" + event.user + ">";
                        attachments = [
                            {
                                text : "How could i help you",
                                colur : "good",
                            }
                        ]
                    }
                    else if(message === "tell me a joke"){
                        text = "Hi <@" + event.user + ">";
                        attachments = [
                            {
                                text : 'Mother to Johnny: “how was your exam, is all questions difficult?”\nJohnny: “No mom, all the questions were simple, It was the answers which gave me all the trouble”!',
                                colur : "good",
                            }
                        ]; 
                    }
                    else if(message.indexOf("weather at") != -1 ){
                        place = message.split("weather at")[1];
                        console.log(place);
                        await new Promise((resolve,reject)=>{
                            request({
                                "url":"https://api.apixu.com/v1/current.json?key=b450e7bbcd6240028c1101243190801&q="+place,
                                method:"GET"
                            },(err,res,body)=>{
                                if(err){
                                    reject(err)
                                }
                                else{
                                    resolve(body);
                                }
                            })
                        })
                        .then(data=>{
                            data = JSON.parse(data);
                            attachments = [
                                {
                                    "title" : "Weather at " + data.location.name,
                                    "fields" : [
                                        {
                                            "title" : "Time",
                                            "value" : data.location.localtime,
                                            "short" : true
                                        },
                                        {
                                            "title" : "Humidity",
                                            "value" : data.current.humidity,
                                            "short" : true
                                        },
                                        {
                                            "title" : "Temperature",
                                            "value" : data.current.temp_f + "F",
                                            "short" : false
                                        },
                                        {
                                            "title" : "Condition",
                                            "value" : data.current.condition.text,
                                            short : false
                                        }
                                    ]
                                }
                            ]
                        })
                        .catch(err=>{
                            console.log(err);
                        })
                        text = "Hi <@" + event.user + ">";
                    }
                    else{
                        text = "Hey <@" + event.user + ">";
                        attachments = [
                            {
                                text : "Sorry i could not understand that",
                                color : "danger",
                            }
                        ]; 
                    }
                }
    
    
                else if(event.channel_type === "channel"){
                    if(message === 'hi'){
                        text = "Hi <@" + event.user + ">";
                        attachments = [
                            {
                                text : "How could i help you",
                                colur : "good",
                            }
                        ]
                    }
                    else if(message === "tell me a joke"){
                        text = "Hi <@" + event.user + ">";
                        attachments = [
                            {
                                text : 'Mother to Johnny: “how was your exam, is all questions difficult?”\nJohnny: “No mom, all the questions were simple, It was the answers which gave me all the trouble”!',
                                colur : "good",
                            }
                        ]; 
                    }
                    else if(message.indexOf("weather at") != -1 ){
                        place = message.split("weather at")[1];
                        console.log(place);
                        await new Promise((resolve,reject)=>{
                            request({
                                "url":"https://api.apixu.com/v1/current.json?key=b450e7bbcd6240028c1101243190801&q="+place,
                                method:"GET"
                            },(err,res,body)=>{
                                if(err){
                                    reject(err)
                                }
                                else{
                                    resolve(body);
                                }
                            })
                        })
                        .then(data=>{
                            data = JSON.parse(data);
                            attachments = [
                                {
                                    "title" : "Weather at " + data.location.name,
                                    "fields" : [
                                        {
                                            "title" : "Time",
                                            "value" : data.location.localtime,
                                            "short" : true
                                        },
                                        {
                                            "title" : "Humidity",
                                            "value" : data.current.humidity,
                                            "short" : true
                                        },
                                        {
                                            "title" : "Temperature",
                                            "value" : data.current.temp_f + "F",
                                            "short" : false
                                        },
                                        {
                                            "title" : "Condition",
                                            "value" : data.current.condition.text,
                                            short : false
                                        }
                                    ]
                                }
                            ]
                        })
                        .catch(err=>{
                            console.log(err);
                        })
                        text = "Hi <@" + event.user + ">";
                    }
                    else{
                        text = "Hey <@" + event.user + ">";
                        attachments = [
                            {
                                text : "Sorry i could not understand that",
                                color : "danger",
                            }
                        ]; 
                    }
                }
                
                request({
                    "url":"https://slack.com/api/chat.postMessage",
                    method:"POST",
                    body:JSON.stringify({
                        "text" : text,
                        "channel" : event.channel,
                        "attachments": attachments
                    }),
                    headers:{"Content-Type":"application/json","Authorization":"Bearer "+access_token}
                },(err,res,body)=>{
                    console.log("inside");
                    if(err){
                        console.log('err');
                    }
                    else{
                        console.log(body);
                    }
                })
            })
            .catch(e => {
                client.release()
                console.log(e.stack)
            })
        })
        .catch(err=>{

        });
    }
    else if(event.type === "app_mention"){

    }
})

//end point for dynamic options
app.post("/slack/options-load",(req,res)=>{
    // console.log((req.body));
    res.status(200).send("hi");
})

//end point for interactive components (message action, Button click)
app.post("/actions",async (req,res)=>{
    attachments = [];
    action = JSON.parse(req.body.payload);
    // console.log(action);
    if(action.type === "interactive_message"){
        var previous_mess = action.original_message;
        attachments = previous_mess.attachments;
        if(attachments === undefined){
            attachments = [];
        }
        if(action.callback_id === "leave_request"){
            attachments[1] = {
                "text":action.actions[0].value,
                "color": action.actions[0].value === "Accepted" ? "good":"danger"
            };
            delete attachments[0].actions;
            text = previous_mess.text;
            return res.status(200).send(({
                "text":previous_mess.text,
                "attachments":attachments
            }));
        }
    }
    else if(action.type === "message_action"){
        var previous_mess = action.message;
        var message  = previous_mess.text;
        attachments = previous_mess.attachments;
        if(attachments === undefined){
            attachments = [];
        }
        if(action.callback_id === "url_shortner"){
            res.status(200).send();
            await pool.connect()
            .then(async client => {
                await client.query("select access_token from user_acc_token where workspace like '"+action.team.id+"'")
                .then(async res => {
                    client.release()
                    // console.log(res.rows[0])
                    access_token = res.rows[0].access_token;

                    // url shortner api call
                    var url = await message.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
                    if(url ===  null){
                        for(var attachment_index in attachments){
                            attachment = attachments[attachment_index];
                            url = await attachment.text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
                            if(url != null){
                                break;
                            }
                        }
                    }
                    if(url === null){
                        attachments.push({"text":"There is no url or link in the message",
                                          "color":"danger"});
                    }
                    
                    else{
                        console.log(url);
                        await new Promise((resolve,reject)=>{request({
                            "url" : "https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyAIhbJMjlCGIxbStFigerDhtKnvW_j7Xs0",
                            method : "POST",
                            body:JSON.stringify({
                                longUrl:url[0]
                            }),
                            headers:{"Content-Type":"application/json"}
                        },(err,res,body)=>{
                            if(err){
                                reject(err);
                            }
                            else{
                                body = JSON.parse(body);
                                // console.log(body.error.errors);
                                short_url = body.id;
                                console.log(short_url);
                                resolve(short_url)
                            }
                        })})
                        .then(data=>{
                            console.log(data);
                            attachments.push({"text":short_url,"color":"good"});
                        })
                        .catch(err=>{
                            console.log(err);
                        })
                    }
                    console.log({
                        "text" : action.message.text,
                        "channel" : action.channel.id,
                        "attachments": attachments,
                        "ts": action.message_ts
                    })
                    request({
                        "url":"https://slack.com/api/chat.update",
                        method:"POST",
                        body:JSON.stringify({
                            "text" : action.message.text,
                            "channel" : action.channel.id,
                            "attachments": attachments,
                            "ts": action.message_ts
                        }),
                        headers:{"Content-Type":"application/json","Authorization":"Bearer "+access_token}
                    },(err,res,body)=>{
                        if(err){
                            console.log('err');
                        }
                        else{
                            console.log(body);
                        }
                    })
                })
                .catch(e => {
                    client.release()
                    console.log(e.stack)
                })
            })
            .catch(err=>{

            });
        }
    }
})

app.listen(5000,()=>{console.log("listening")});