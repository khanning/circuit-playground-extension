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

  var BUFFER_SIZE = 10;

  var CMD_DIGITAL_WRITE = 0x83,
      CMD_ANALOG_WRITE = 0x84;

  var rawData = [];
  var inputData = null;
  var device = null;

  var rx = {};
  rx[RX_CHAR] = {notify: true};
  var tx = {};
  tx[TX_CHAR] = {};

  var device_info = {uuid: [UUID]};
  device_info["read_characteristics"] = rx;
  device_info["write_characteristics"] = tx;

  function map(val, aMin, aMax, bMin, bMax) {
    if (val > aMax) val = aMax;
    else if (val < aMin) val = aMin;
    return (((bMax - bMin) * (val - aMin)) / (aMax - aMin)) + bMin;
  }

  function getTiltAngle(dir) {
    if (dir === 'up') {
      if (inputData[7] > 10) {
        return (256 - inputData[7]) * 10;
      } else {
        return inputData[7] * -10;
      }
    } else if (dir === 'down') {
      if (inputData[7] > 10) {
        return (256 - inputData[7]) * -10;
      } else {
        return inputData[7] * 10;
      }
    } else if (dir === 'left') {
      if (inputData[8] > 10) {
        return (256 - inputData[8]) * 10;
      } else {
        return inputData[8] * -10;
      }
    } else if (dir === 'right') {
      if (inputData[8] > 10) {
        return (256 - inputData[8]) * -10;
      } else {
        return inputData[8] * 10;
      }
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

  ext.setLED = function(l, c) {
    var led = parseInt(l);
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(led)) return;
    var r = (c >> 16) & 0xFF;
    var g = (c >> 8) & 0xFF;
    var b = c & 0xFF;
    var output = [0x80, led, r, g, b];
    device.emit('write', {uuid: TX_CHAR, bytes: output});
  };

  ext.setLEDRGB = function(l, r, g, b) {
    var led = parseInt(l);
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(r)) return;
    if (!Number.isInteger(g)) return;
    if (!Number.isInteger(b)) return;
    var output = [0x80, led, r, g, b];
    device.emit('write', {uuid: TX_CHAR, bytes: output});
  };

  ext.clearLED = function(l) {
    var led = parseInt(l);
    if (l === 'all')
      led = 0;
    if (!Number.isInteger(led)) return;
    device.emit('write', {uuid: TX_CHAR, bytes: [0x81, led]});
  };

  ext.getSlider = function() {
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
      return steinhart * 1.8 + 32;
    else
      return steinhart;
  };

  ext.getBrightness = function() {
    var brightness = (inputData[5] << 8 | inputData[6]);
    return Math.round(map(brightness, 0, 1023, 0, 100));
  };

  ext.playNote = function(note, dur) {
    var freq = 440 * Math.pow(1.05946309436, note-69);
    freq = Math.round(freq);
    if (dur < 0) return;
    if (dur > 255) dur = 255;
    var output = [0x82, freq >> 8, freq & 0xFF, dur];
    console.log(output);
    device.emit('write', {uuid: TX_CHAR, bytes: output});
  };

  ext.whenTilted = function(dir) {
    if (dir === 'any')
      return (inputData[7] != 0 || inputData[8] != 0);
    else
      return getTiltAngle(dir) >= 10;
  }

  ext.isTilted = function(dir) {
    if (dir === 'any')
      return (inputData[7] != 0 || inputData[8] != 0);
    else
      return getTiltAngle(dir) >= 10;
  };

  ext.getTiltAngle = function(dir) {
    return getTiltAngle(dir);
  };

  ext.setClipDigital = function(pin, state) {
    if (pin != 6 && pin != 9 && pin != 10 && pin != 11)
      return;
    var output = [CMD_DIGITAL_WRITE, pin, 0];
    if (state === "on")
      output[2] = 1;
    device.emit('write', {uuid: TX_CHAR, bytes: output});
  };

  ext.setClipAnalog = function(pin, val) {
    if (pin != 6 && pin != 9 && pin != 10 && pin != 11)
      return;
    if (val > 100) val = 100;
    else if (val < 0) val = 0;
    var output = [CMD_ANALOG_WRITE, pin, val];
    device.emit('write', {uuid: TX_CHAR, bytes: output});
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
          if (bytes.data.length === 10) {
            inputData = bytes.data;
            console.log(inputData);
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
    ['h', 'when %m.btnSides button pressed', 'whenbuttonPressed', 'left'],
    ['b', '%m.btnSides button pressed?', 'isButtonPressed', 'left'],
    [' '],
    ['b', 'slider', 'getSlider'],
    ['r', 'temperature in %m.temp', 'getTemp', 'F'],
    ['r', 'brightness', 'getBrightness'],
    [' '],
    [' ', 'set LED %d.leds to %c', 'setLED', '1', 0xFF0000],
    [' ', 'set LED %d.leds to R:%n G:%n B:%n', 'setLEDRGB', '1', 0, 255, 0],
    [' ', 'turn LED %d.leds off', 'clearLED', '1'],
    [' '],
    [' ', 'play note %d.note for %n second', 'playNote', 60, 1],
    [' '],
    ['h', 'when tilted %m.tiltDirs', 'isTilted', 'any'],
    ['b', 'tilted %m.tiltDirs ?', 'isTilted', 'any'],
    ['r', 'tilt angle %m.tiltAngleDirs', 'getTiltAngle', 'up'],
    [' '],
    [' ', 'set pin %d.clipPins %m.states', 'setClipDigital', 6, 'on'],
    [' ', 'set pin %d.clipPins to %n%', 'setClipAnalog', 6, '50']
  ];

  var menus = {
    btnSides: ['left', 'right', 'any'],
    leds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'all'],
    tiltDirs: ['any', 'up', 'down', 'left', 'right'],
    tiltAngleDirs: ['up', 'down', 'left', 'right'],
    temp: ['F', 'C'],
    clipPins: [6, 9, 10, 12],
    states: ['on', 'off']
  };

  var descriptor = {
    blocks: blocks,
    menus: menus,
    url: 'http://scratch.mit.edu'
  };

  ScratchExtensions.register('Circuit Playground', descriptor, ext, {info: device_info, type: 'ble'});
})({});
