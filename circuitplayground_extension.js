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

  var UUID = '6e400001b5a3f393e0a9e50e24dcca9e',
    TX_CHAR = '6e400002b5a3f393e0a9e50e24dcca9e',
    RX_CHAR = '6e400003b5a3f393e0a9e50e24dcca9e';

  var BUFFER_SIZE = 10;

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
    console.log(output);
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

  ext.getTemp = function() {
    return (inputData[3] << 8 | inputData[4]);
  };

  ext.getBrightness = function() {
    var brightness = (inputData[5] << 8 | inputData[6]);
    return Math.round(map(brightness, 0, 1023, 0, 100));
  };

  ext.whenTilted = function(dir) {
    if (dir === 'any')
      return (inputData[7] != 0 || inputData[8] != 0);
    else if (dif === 'up')
      return (256 - inputData[7]) > 0;
    else if (dif === 'down')
      return inputData[7] > 0;
    else if (dif === 'left')
      return (256 - inputData[8]) > 0;
    else if (dif === 'right')
      return inputData[8] > 0;
    return false;
  };

  ext.isTilted = function(dir) {
    if (dir === 'any')
      return (inputData[7] != 0 || inputData[8] != 0);
    else if (dif === 'up')
      return (256 - inputData[7]) > 0;
    else if (dif === 'down')
      return inputData[7] > 0;
    else if (dif === 'left')
      return (256 - inputData[8]) > 0;
    else if (dif === 'right')
      return inputData[8] > 0;
    return false;
  };

  ext.getTiltAngle = function(dir) {
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
          for (var i=0; i<bytes.data.length; i++) {
            if (bytes.data[i] != 0xA) {
              rawData = rawData.concat(bytes.data[i]);
            } else {
              if (rawData.length == BUFFER_SIZE) {
                //processInput(rawData);
                inputData = rawData;
              } else {
                console.log("wrong data size");
              }
              rawData = [];
            }
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
    [' '],
    ['b', '%m.btnSides button pressed?', 'isButtonPressed', 'left'],
    ['b', 'slider', 'getSlider'],
    [' '],
    [' ', 'set LED %d.leds to %c', 'setLED', '1', 0xFF0000],
    [' ', 'turn LED %d.leds off', 'clearLED', '1'],
    [' '],
    ['r', 'temperature', 'getTemp'],
    [' '],
    ['r', 'brightness', 'getBrightness'],
    [' '],
    ['h', 'when tilted %m.tiltDirs', 'whenTilted', 'any'],
    ['b', 'tilted %m.tiltDirs ?', 'isTilted', 'any'],
    ['r', 'tilt angle %m.tiltAngleDirs', 'getTiltAngle', 'up']
  ];

  var menus = {
    btnSides: ['left', 'right', 'any'],
    leds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'all'],
    tiltDirs: ['any', 'up', 'down', 'left', 'right'],
    tiltAngleDirs: ['up', 'down', 'left', 'right']
  };

  var descriptor = {
    blocks: blocks,
    menus: menus,
    url: 'http://scratch.mit.edu'
  };

  ScratchExtensions.register('Circuit Playground', descriptor, ext, {info: device_info, type: 'ble'});
})({});
