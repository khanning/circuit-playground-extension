 /*This program is free software: you can redistribute it and/or modify
 *it under the terms of the GNU General Public License as published by
 *the Free Software Foundation, either version 3 of the License, or
 *(at your option) any later version.
 *
 *This program is distributed in the hope that it will be useful,
 *but WITHOUT ANY WARRANTY; without even the implied warranty of
 *MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *GNU General Public License for more details.
 *
 *You should have received a copy of the GNU General Public License
 *along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function(ext) {

  var UUID = 'aa6d1edba1a1464099a19c4bf388205a',
    RX_CHAR = 'aa6d1edba1a1464199a19c4bf388205a',
    TX_CHAR = 'aa6d1edba1a1464299a19c4bf388205a';

  var BUFFER_SIZE = 9;

  var CMD_SET_LED = 0x80,
      CMD_CLEAR_LED = 0x81,
      CMD_LED_BRIGHTNESS = 0x82,
      CMD_TONE = 0x83,
      CMD_DIGITAL_WRITE = 0x84,
      CMD_ANALOG_WRITE = 0x85,
      CMD_SERVO_WRITE = 0x86;

  var WRITE_DELAY = 60;

  var activePads = [0, 1, 2, 6, 9, 12];

  var rawData = [];
  var inputData = null;
  var device = null;
  var cmdID = 1;

  var tiltX = 0,
    tiltY = 0;

  var rx = {};
  rx[RX_CHAR] = {notify: true};
  var tx = {};
  tx[TX_CHAR] = {};

  var device_info = {uuid: [UUID]};
  device_info["read_characteristics"] = rx;
  device_info["write_characteristics"] = tx;

  function send(output, callback) {
    output.unshift(cmdID++);
    if (cmdID > 255) cmdID = 1;
    device.emit('write', {uuid: TX_CHAR, bytes: output});
    setTimeout(callback, WRITE_DELAY);
  }

  function processInput(data) {
    inputData = data;
    tiltX = inputData[7] & 0x7F;
    if (inputData[7] >> 7) tiltX *= -1;
    tiltY = inputData[8] & 0x7F;
    if (inputData[8] >> 7) tiltY *= -1;
  }

  function getRandomColor() {
    return Math.floor(Math.random() * (255 - 0));
  }

  function map(val, aMin, aMax, bMin, bMax) {
    if (val > aMax) val = aMax;
    else if (val < aMin) val = aMin;
    return (((bMax - bMin) * (val - aMin)) / (aMax - aMin)) + bMin;
  }

  function getTiltAngle(dir) {
    if (dir === 'up') {
      return tiltX * -1;
    } else if (dir === 'down') {
      return tiltX;
    } else if (dir === 'left') {
      return tiltY * -1;
    } else if (dir === 'right') {
      return tiltY;
    }
  }

  ext.whenButtonPressed = function(btn) {
    if (btn === 'left') {
      return inputData[0];
    } else if (btn === 'right') {
      return inputData[1];
    } else if (btn === 'any') {
      return (inputData[0] || inputData[1]);
    }
    return false;
  };

  ext.isButtonPressed = function(btn) {
    if (btn === 'left') {
      return inputData[0];
    } else if (btn === 'right') {
      return inputData[1];
    } else if (btn === 'any') {
      return (inputData[0] || inputData[1]);
    }
    return false;
  };

  ext.setLED = function(l, c, callback) {
    var led = parseInt(l);
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(led)) return;
    var r = (c >> 16) & 0xFF;
    var g = (c >> 8) & 0xFF;
    var b = c & 0xFF;
    var output = [CMD_SET_LED, led, r, g, b];
    send(output, callback);
  };

  ext.setLEDRGB = function(l, r, g, b, callback) {
    var led = parseInt(l);
    if (led < 1) return;
    if (led > 10) return;
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(r)) return;
    if (!Number.isInteger(g)) return;
    if (!Number.isInteger(b)) return;
    var output = [CMD_SET_LED, led, r, g, b];
    send(output, callback);
  };

  ext.setLEDRandom = function(l, callback) {
    var led = parseInt(l);
    if (led < 1) return;
    if (led > 10) return;
    if (l === 'all')
      led = 0;
    var output = [CMD_SET_LED, led, getRandomColor(), getRandomColor(), getRandomColor()];
    send(output, callback);
  };

  ext.setLEDBrightness = function(brightness, callback) {
    if (isNaN(brightness)) return;
    if (brightness > 100) brightness = 100;
    else if (brightness < 0) brightness = 0;
    send([CMD_LED_BRIGHTNESS, brightness], callback);
  };

  ext.clearLED = function(l, callback) {
    var led = parseInt(l);
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(led)) return;
    send([CMD_CLEAR_LED, led], callback);
  };

  ext.getSwitch = function() {
    return inputData[2];
  };

  ext.getTemp = function(type) {
    var reading = (inputData[3] << 8) | inputData[4];
    reading = ((1023 * 10000) / reading);
    reading -= 10000;
    var steinhart = reading / 10000;
    steinhart = Math.log(steinhart);
    steinhart /= 3380;
    steinhart += 1.0 / (25 + 273.15);
    steinhart = 1.0 / steinhart;
    steinhart -= 273.15;
    if (type === "F")
      return (steinhart * 1.8 + 32).toFixed(2);
    else
      return steinhart.toFixed(2);
  };

  ext.getBrightness = function() {
    var brightness = (inputData[5] << 8 | inputData[6]);
    return Math.round(map(brightness, 0, 200, 0, 100));
  };

  ext.playNote = function(note, dur, callback) {
    var freq = 440 * Math.pow(1.05946309436, note-69);
    freq = Math.round(freq);
    if (dur < 0) return;
    if (dur > 255) dur = 255;
    dur = Math.round(dur * 1000);
    var output = [CMD_TONE, freq >> 8, freq & 0xFF, dur >> 8, dur & 0xFF];
    send(output, null);
    setTimeout(callback, dur);
  };

  function isTilted(dir) {
    if (dir === 'any')
      return (Math.abs(tiltX) > 15 || Math.abs(tiltY) < 15);
    else
      return getTiltAngle(dir) > 15;
  }

  ext.whenTilted = function(dir) {
    return isTilted(dir);
  }

  ext.isTilted = function(dir) {
    return isTilted(dir);
  };

  ext.getTiltAngle = function(dir) {
    return getTiltAngle(dir);
  };

  ext.setClipDigital = function(pin, state, callback) {
    if (pin != 6 && pin != 9 && pin != 10 && pin != 12)
      return;
    var output = [CMD_DIGITAL_WRITE, pin, 0];
    if (state === "on")
      output[2] = 1;
    send(output, callback);
  };

  ext.setClipAnalog = function(pin, val, callback) {
    if (pin != 6 && pin != 9 && pin != 10 && pin != 12)
      return;
    if (val > 100) val = 100;
    else if (val < 0) val = 0;
    var output = [CMD_ANALOG_WRITE, pin, val];
    send(output, callback);
  };

  ext.setServo = function(pin, val, callback) {
    pin = parseInt(pin);
    val = parseInt(val);
    if (activePads.indexOf(pin) < 0 || isNaN(val)) {
      callback();
      return;
    }
    if (val > 180) val = 180;
    else if (val < 0) val = 0;
    var output = [CMD_SERVO_WRITE, pin, val];
    send(output, callback);
  };

  ext._getStatus = function() {
    if (device) {
      if (device.is_open()) {
        return {status: 2, msg: 'Scratch Pad connected'};
      } else {
        return {status: 1, msg: 'Scratch Pad connecting...'};
      }
    } else {
      return {status: 1, msg: 'ScratchPad disconnected'};
    }
  };

  ext._deviceConnected = function(dev) {
    if (device) return;
    device = dev;
    device.open(function(d) {
      if (device == d) {
        device.on(RX_CHAR, function(bytes) {
          if (bytes.data.length === BUFFER_SIZE) {
            processInput(bytes.data);
          }
        });
      } else if (d) {
        console.log('Received open callback for wrong device');
      } else {
        console.log('Opening device failed');
        device = null;
      }
    });
  };

  ext._deviceRemoved = function(dev) {
    rawData = [];
    if (device != dev) return;
    device = null;
  };

  ext._shutdown = function() {
    if (device) device.close();
    device = null;
  };

  var blocks = [
    ['h', 'when %m.btnSides button pressed', 'whenButtonPressed', 'left'],
    ['b', '%m.btnSides button pressed?', 'isButtonPressed', 'left'],
    [' '],
    ['b', 'switch?', 'getSwitch'],
    ['r', 'temperature in %m.temp', 'getTemp', 'F'],
    ['r', 'brightness', 'getBrightness'],
    [' '],
    ['w', 'set LED %d.leds to %c', 'setLED', '1', 0xFF0000],
    ['w', 'set LED %d.leds to R:%n G:%n B:%n', 'setLEDRGB', '1', 0, 255, 0],
    ['w', 'set LED %d.leds to random', 'setLEDRandom', '1'],
    ['w', 'set LED brightness to %n%', 'setLEDBrightness', 50],
    ['w', 'turn LED %d.leds off', 'clearLED', '1'],
    [' '],
    ['w', 'play note %d.note for %n second', 'playNote', 60, 1],
    [' '],
    ['h', 'when tilted %m.tiltDirs', 'whenTilted', 'any'],
    ['b', 'tilted %m.tiltDirs ?', 'isTilted', 'any'],
    ['r', 'tilt angle %m.tiltAngleDirs', 'getTiltAngle', 'up'],
    [' '],
    ['w', 'set pad %d.clipPins %m.states', 'setClipDigital', 6, 'on'],
    //['w', 'set pad %d.clipPins to %n%', 'setClipAnalog', 6, '50'],
    [' '],
    ['w', 'turn servo %d.clipPins to %n degrees', 'setServo', 6, 100]
  ];

  var menus = {
    btnSides: ['left', 'right', 'any'],
    leds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'all'],
    tiltDirs: ['any', 'up', 'down', 'left', 'right'],
    tiltAngleDirs: ['up', 'down', 'left', 'right'],
    temp: ['F', 'C'],
    clipPins: activePads,
    states: ['on', 'off']
  };

  var descriptor = {
    blocks: blocks,
    menus: menus,
    url: 'http://scratch.mit.edu'
  };

  ScratchExtensions.register('Circuit Playground', descriptor, ext, {info: device_info, type: 'ble'});
})({});
