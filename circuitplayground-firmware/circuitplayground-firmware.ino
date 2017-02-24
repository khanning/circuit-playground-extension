#include "Adafruit_BLE.h"
#include "Adafruit_BluefruitLE_UART.h"
#include "Adafruit_BLEGatt.h"

#include <Adafruit_CircuitPlayground.h>

#define UPDATE_FREQ 200000
#define OUTPUT_BUFFER_SIZE 10
#define MAX_INPUT_BUFFER 16

uint8_t SERVICE_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x40, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};
uint8_t TX_CHAR_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x41, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};
uint8_t RX_CHAR_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x42, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};

Adafruit_BluefruitLE_UART ble(Serial1, -1);
Adafruit_BLEGatt gatt(ble);

uint8_t serviceId;
uint8_t txCharId;
uint8_t rxCharId;

long nextUpdate;
boolean newData;

uint8_t outputBuffer[OUTPUT_BUFFER_SIZE];
byte inputBuffer[MAX_INPUT_BUFFER];

byte CMD_SET_LED = 0x80;
byte CMD_CLEAR_LED = 0x81;
byte CMD_TONE = 0x82;
byte CMD_DIGITAL_WRITE = 0x83;
byte CMD_ANALOG_WRITE = 0x84;

boolean waitForCommand = false;
byte commandSize = 0;
byte commandIndex = 0;

void setup() {
  CircuitPlayground.begin();
  CircuitPlayground.setAccelRange(LIS3DH_RANGE_2_G);
  //Serial.begin(9600);
  initBLE();
  //Serial.println("starting serial");
  nextUpdate = micros() + UPDATE_FREQ;
}

void loop() {
  uint8_t tmpBuffer[MAX_INPUT_BUFFER];
  byte i;
  
  updateSensors();
  gatt.setChar(txCharId, outputBuffer, OUTPUT_BUFFER_SIZE);
  gatt.getChar(rxCharId, tmpBuffer, MAX_INPUT_BUFFER);
  for (i=0; i<MAX_INPUT_BUFFER; i++) {
    if (tmpBuffer[i] != inputBuffer[i]) {
      memcpy(inputBuffer, tmpBuffer, sizeof(tmpBuffer[0])*MAX_INPUT_BUFFER);
      processCmd(inputBuffer);
      break;
    }
  }
  
}

void processCmd(uint8_t inputBuffer[]) {
  if (inputBuffer[0] == CMD_SET_LED) {
    if (inputBuffer[1] == 0) {
      for (byte i=0; i<10; i++) {
        CircuitPlayground.setPixelColor(i, inputBuffer[2], inputBuffer[3], inputBuffer[4]);  
      }
    } else {
      Serial.println(inputBuffer[4]);
      CircuitPlayground.setPixelColor(inputBuffer[1]-1, inputBuffer[2], inputBuffer[3], inputBuffer[4]);  
    }
  } else if (inputBuffer[0] == CMD_CLEAR_LED) {
    if (inputBuffer[1] == 0) {
      CircuitPlayground.clearPixels();
    } else {
      CircuitPlayground.setPixelColor(inputBuffer[1]-1, 0, 0, 0);  
    }
  } else if (inputBuffer[0] == CMD_TONE) {
    int t = inputBuffer[1] << 8 | inputBuffer[2];
    CircuitPlayground.playTone(t, inputBuffer[3]*1000);
  } else if (inputBuffer[0] == CMD_DIGITAL_WRITE) {
    digitalWrite(inputBuffer[1], inputBuffer[2]);
  } else if (inputBuffer[0] == CMD_ANALOG_WRITE) {
    digitalWrite(inputBuffer[1], map(inputBuffer[2], 0, 100, 0, 1023));
  }
}

void initBLE() {
  ble.begin(false);
  ble.factoryReset();
  ble.echo(false);
  ble.setInterCharWriteDelay(5);

  ble.sendCommandCheckOK(F("AT+GAPDEVNAME=CircuitPlayground Scratch"));

  serviceId = gatt.addService(SERVICE_UUID);
  txCharId = gatt.addCharacteristic(TX_CHAR_UUID, GATT_CHARS_PROPERTIES_READ | GATT_CHARS_PROPERTIES_NOTIFY, 10, 10, BLE_DATATYPE_BYTEARRAY);
  rxCharId = gatt.addCharacteristic(RX_CHAR_UUID, GATT_CHARS_PROPERTIES_READ | GATT_CHARS_PROPERTIES_WRITE, 16, 16, BLE_DATATYPE_BYTEARRAY);
  
  uint8_t advdata[] = {0x02, 0x01, 0x06, 0x11, 0x06, 0x5A, 0x20, 0x88, 0xF3, 0x4B, 0x9C, 0xA1, 0x99, 0x40, 0x46, 0xA1, 0xA1, 0xDB, 0x1E, 0x6D, 0xAA};
  ble.setAdvData(advdata, sizeof(advdata));
  
  ble.setInterCharWriteDelay(4);
  ble.reset();

  //ble.setBleGattRxCallback(rxCharId, onRxWrite);
}

void updateSensors() {
  int temp, light;
  byte i;
  
  outputBuffer[0] = CircuitPlayground.leftButton();
  outputBuffer[1] = CircuitPlayground.rightButton();
  outputBuffer[2] = CircuitPlayground.slideSwitch();

  temp = analogRead(A0);
  outputBuffer[3] = temp >> 8;
  outputBuffer[4] = temp & 0xFF;

  light = CircuitPlayground.lightSensor();
  outputBuffer[5] = light >> 8;
  outputBuffer[6] = light & 0xFF;

  outputBuffer[7] = CircuitPlayground.motionX();
  outputBuffer[8] = CircuitPlayground.motionY();
  outputBuffer[9] = CircuitPlayground.motionZ();

  /*for (i=0; i<OUTPUT_BUFFER_SIZE; i++) {
    if (tmpBuffer[i] != outputBuffer[i]) {
      outputBuffer[i] = tmpBuffer[i];
      newData = true;
    }
  }*/
}
