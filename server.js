var PATH_TO_SERIAL_PORT = '';
var path = require('path');
var fs = require('fs');
var express = require('express');
var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
// var SerialPort = require('virtual-serialport');
// if (process.env.NODE_ENV == 'development') {
//   console.log('Virtual Serial Port Activated');
//   SerialPort = require('virtual-serialport');
// }
var sp = new SerialPort('/dev/tty.usbserial', { baudrate: 9600 });
var rpm, mph = 0;

var currentData= [];
var frameStarted = false;
var lengthByte;
function handleData(data, bytesExpected){
  for(var i = 0; i < data.length; i++){
    var char = data.toString('hex',i,i+1);
    if(char === "ff"){
      frameStarted = true;
      currentData = [];
      lengthByte = undefined;
    }else if(frameStarted){
      if(!lengthByte){
        lengthByte = parseInt(char, 16);
      }else{
        currentData.push(parseInt(char, 16));
      }
    }
  }
  if(currentData.length === bytesExpected){
    frameStarted = false;
    // console.log(lengthByte === bytesExpected);
    return currentData.slice();
  }
}

function parseData(data){

  if(data !== undefined){
    var dataRPM = ((data[1] << 8) + data[2]) * 12.5
    rpm = dataRPM
    // console.log(data);
  }

}

// LIST ALL SERIAL PORTS AND SOME DATA ABOUT THEM
// serialport.list(function (err, ports) {
//   ports.forEach(function(port) {
//     console.log(port.comName);
//     console.log(port.pnpId);
//     console.log(port.manufacturer);
//   });
// });
var isConnected = false;
var command = [0x5A,0x08,0x5A,0x00,0x5A,0x01,0xF0];
var bytesRequested = (command.length - 1) / 2;
sp.on("open", function () {
  console.log('open');
  sp.on('data', function(data) {
    // console.log("data: " + JSON.stringify(data, null, 4));
    // console.log("data: " + data.toString('hex'));
    if(!isConnected && data.toString('hex') === "10"){
      console.log("connected");
      isConnected = true;
      // sp.write([0x5A,0x0B,0x5A,0x01,0x5A,0x08,0x5A,0x0C,0x5A,0x0D,0x5A,0x03,0x5A,0x05,0x5A,0x09,0x5A,0x13,0x5A,0x16,0x5A,0x17,0x5A,0x1A,0x5A,0x1C,0x5A,0x21,0xF0], function(err,results){
      //   // console.log("results2: " + typeof results);
      // });
      sp.write(command, function(err,results){
        // console.log("results2: " + typeof results);
      });
    }else{
      // console.log(data);
      parseData(handleData(data, bytesRequested));

    }

  });
  sp.write([0xFF, 0xFF, 0xEF], function(err, results) {
    console.log("results: " + results);
  });
});

// Server part
var app = express();

app.use('/', express.static(path.join(__dirname, 'public')));

var server = app.listen(8090);
console.log('Server listening on port 8090');

// Socket.IO part
var io = require('socket.io')(server);

io.on('connection', function (socket) {
  console.log('New client connected!');
    //send data to client
    setInterval(function(){
      if(mph < 120){
        mph += 1
      } else{
        mph = 0
      }
      socket.emit('ecuData', {'rpm':rpm,'mph':mph});
    }, 20);
});
