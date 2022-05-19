const app = require('express')();
const { MongoClient, ObjectId } = require('mongodb');
const url = 'mongodb://localhost:27017/chat';
const httpServer = require('http').createServer(app);
const multer = require('multer');
var path = require('path')
const io = require('socket.io')(httpServer, {
    maxHttpBufferSize: 1e9,
    cors: { origin: '*' }
});
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('hello!');
});

MongoClient.connect(url, function(err, db) {
    if (err) {
        throw err;
    }
    console.log("MongoDb connected...");

    io.on('connection', (socket) => {
        var database = db.db("chat");
        let table = database.collection('message');
        console.log('a user connected');
        

        socket.on('join', (data) => {
            socket.join(data.roomId);

            table.updateMany(
                { room: data.roomId , user:{$ne:data.user }, read:"no"},
                {$set: { read:"yes"}}
            ).then( result =>
                table.find({ room: data.roomId }).limit(15).sort({ $natural: -1 }).toArray(function(err, docs) {
                    if (!err) {
                        if (docs.length > 0) {
                            io.to(data.roomId).emit('old message', docs);
                        }
                    }
                })
            );
        });

        socket.on('message', (data) => {
            table.insertOne(data).then(result =>
                table.find({ room: data.room }).sort({ $natural: -1 }).limit(1).toArray(function(err, docs) {
                    if (!err) {
                        if (docs.length > 0) {
                            io.to(data.room).emit('new message', docs), 100
                        }
                    }
                })
            );
        });

        socket.on('need message', (data) => {
            table.find({ room: data.room}).sort({ $natural: -1 }).skip(data.number).limit(15).toArray(function(err, docs) {
                if (!err) {
                    if (docs.length > 0) {
                        io.to(data.room).emit('got old message', docs);
                    }
                }                
            });
        });

        socket.on('image', (data) => {
            table.insertOne(data).then( result =>
                table.find({ room: data.room }).sort({ $natural: -1 }).limit(1).toArray(function(err, docs) {
                    if (!err) {
                        if (docs.length > 0) {
                            io.to(data.room).emit('new message', docs)
                        }
                    }
                })
            );
        });

        socket.on('messageSeen', (data) => {
            table.updateOne(
                { _id: ObjectId(data.id) },
                {$set: { read:"yes"}}
            ).then( res => 
                table.find({_id: ObjectId(data.id)}).toArray(function(err,docs){
                    if(!err){
                        io.to(data.room).emit('updateSeenMessage', docs);
                    }                    
                })
            );
        });
    });
});


httpServer.listen(port, () => console.log(`listening on port ${port}`));