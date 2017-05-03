#include "Adafruit_BLE.h"
#include "Adafruit_BluefruitLE_SPI.h"
#include "Adafruit_BLEGatt.h"
#include <Adafruit_CircuitPlayground.h>
#include <Servo.h>

#define UPDATE_FREQ 100000
#define OUTPUT_BUFFER_SIZE 9
#define MAX_INPUT_BUFFER 16

uint8_t SERVICE_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x40, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};
uint8_t TX_CHAR_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x41, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};
uint8_t RX_CHAR_UUID[] = {0xAA, 0x6D, 0x1E, 0xDB, 0xA1, 0xA1, 0x46, 0x42, 0x99, 0xA1, 0x9C, 0x4B, 0xF3, 0x88, 0x20, 0x5A};

Adafruit_BluefruitLE_SPI ble(3, 10, -1);
Adafruit_BLEGatt gatt(ble);

Adafruit_CPlay_LIS3DH lis;
Adafruit_CPlay_NeoPixel strip;

uint8_t serviceId;
uint8_t txCharId;
uint8_t rxCharId;

long nextUpdate;

uint8_t outputBuffer[OUTPUT_BUFFER_SIZE];
byte inputBuffer[MAX_INPUT_BUFFER];
byte inputCmdId;

byte CMD_SET_LED = 0x80;
byte CMD_CLEAR_LED = 0x81;
byte CMD_LED_BRIGHTNESS = 0x82;
byte CMD_TONE = 0x83;
byte CMD_DIGITAL_WRITE = 0x84;
byte CMD_ANALOG_WRITE = 0x85;
byte CMD_SERVO_WRITE = 0x86;

boolean waitForCommand = false;
byte commandSize = 0;
byte commandIndex = 0;

byte padModes[13];
byte activePads[] = {0, 1, 2, 6, 9, 12};
Servo servos[13];

int ax, ay;
double adelta = 0.3;

void setup() {
  byte i;
  Serial.begin(9600);

  for (i=0; i<6; i++) {
    pinMode(activePads[i], OUTPUT);
    padModes[activePads[i]] = OUTPUT;
  }

  pinMode(CPLAY_BUZZER, OUTPUT);
  pinMode(CPLAY_LEFTBUTTON, INPUT);
  pinMode(CPLAY_RIGHTBUTTON, INPUT);
  pinMode(CPLAY_SLIDESWITCHPIN, INPUT);
  pinMode(0, OUTPUT);
  pinMode(1, OUTPUT);
  pinMode(6, OUTPUT);
  pinMode(12, OUTPUT);

  initAccel();
  initNeoPixel();
  initBLE();
  
  nextUpdate = micros() + UPDATE_FREQ;
}

void initAccel() {
  lis = Adafruit_CPlay_LIS3DH(CPLAY_LIS3DH_CS);
  lis.begin(0x18);
  lis.setRange(LIS3DH_RANGE_2_G);
}

void initNeoPixel() {
  strip = Adafruit_CPlay_NeoPixel();
  strip.updateType(NEO_GRB + NEO_KHZ800);
  strip.updateLength(10);
  strip.setPin(CPLAY_NEOPIXELPIN);
  strip.begin();
  strip.clear();
  strip.show();
  strip.setBrightness(30);
}

void initBLE() {
  ble.begin(false);
  ble.factoryReset();
  ble.echo(false);

  // Name device
  ble.sendCommandCheckOK(F("AT+GAPDEVNAME=CircuitPlayground Scratch"));

  // Set up services and characteristics
  serviceId = gatt.addService(SERVICE_UUID);
  txCharId = gatt.addCharacteristic(TX_CHAR_UUID, GATT_CHARS_PROPERTIES_READ | GATT_CHARS_PROPERTIES_NOTIFY, 9, 9, BLE_DATATYPE_BYTEARRAY);
  rxCharId = gatt.addCharacteristic(RX_CHAR_UUID, GATT_CHARS_PROPERTIES_READ | GATT_CHARS_PROPERTIES_WRITE, 1, 16, BLE_DATATYPE_BYTEARRAY);  
  
  // Set advertising data
  uint8_t advdata[] = {0x02, 0x01, 0x06, 0x11, 0x06, 0x5A, 0x20, 0x88, 0xF3, 0x4B, 0x9C, 0xA1, 0x99, 0x40, 0x46, 0xA1, 0xA1, 0xDB, 0x1E, 0x6D, 0xAA};
  ble.setAdvData(advdata, sizeof(advdata));

  // Reset BLE module
  ble.reset();
}

void processCmd(uint8_t inputBuffer[]) {
  if (inputBuffer[1] == CMD_SET_LED) {
    if (inputBuffer[2] == 0) {
      for (byte i=0; i<10; i++) {
        strip.setPixelColor(i, inputBuffer[3], inputBuffer[4], inputBuffer[5]);
        strip.show();
      }
    } else {
      strip.setPixelColor(inputBuffer[2]-1, inputBuffer[3], inputBuffer[4], inputBuffer[5]);
      strip.show();
    }
  } else if (inputBuffer[1] == CMD_CLEAR_LED) {
    
    if (inputBuffer[2] == 0) {
      strip.clear();
      strip.show();
    } else {
      strip.setPixelColor(inputBuffer[2]-1, 0, 0, 0);
      strip.show();
    }
    
  } else if (inputBuffer[1] == CMD_LED_BRIGHTNESS) {

    byte brightness = inputBuffer[2];
    strip.setBrightness(brightness);
    strip.show();
    
  } else if (inputBuffer[1] == CMD_TONE) {
    
    int t = inputBuffer[2] << 8 | inputBuffer[3];
    int dur = inputBuffer[4] << 8 | inputBuffer[5];
    tone(CPLAY_BUZZER, t, dur);
    
  } else if (inputBuffer[1] == CMD_DIGITAL_WRITE) {

    byte pin = inputBuffer[2];
    byte state = inputBuffer[3];
    if (padModes[pin] != OUTPUT) {
      pinMode(padModes[pin], OUTPUT);
      padModes[pin] = OUTPUT;
    }
    digitalWrite(inputBuffer[2], inputBuffer[3]);
    
  } else if (inputBuffer[1] == CMD_ANALOG_WRITE) {

    byte pin = inputBuffer[2];
    byte val = inputBuffer[3];
    if (padModes[pin] != OUTPUT) {
      pinMode(padModes[pin], OUTPUT);
      padModes[pin] = OUTPUT;
    }
    analogWrite(pin, map(val, 0, 100, 0, 255));
    
  } else if (inputBuffer[1] == CMD_SERVO_WRITE) {

    byte pin = inputBuffer[2];
    byte deg = inputBuffer[3];
    if (!servos[pin].attached()) {
      servos[pin].attach(pin);
      servos[pin].write(deg);
      padModes[pin] = SERVO;
    } else {
      servos[pin].write(deg);
    }
    
  }
}

void updateSensors() {
  int temp, light, rawX, rawY;
  byte i;
  
  outputBuffer[0] = digitalRead(CPLAY_LEFTBUTTON);
  outputBuffer[1] = digitalRead(CPLAY_RIGHTBUTTON);
  outputBuffer[2] = digitalRead(CPLAY_SLIDESWITCHPIN);

  temp = analogRead(CPLAY_THERMISTORPIN);
  outputBuffer[3] = temp >> 8;
  outputBuffer[4] = temp & 0xFF;

  light = analogRead(CPLAY_LIGHTSENSOR);
  outputBuffer[5] = light >> 8;
  outputBuffer[6] = light & 0xFF;

  sensors_event_t event;
  lis.getEvent(&event);
  rawX = round(event.acceleration.x * 9);
  rawY = round(event.acceleration.y * 9);
  ax = rawX * adelta + (ax * (1.0 - adelta));
  ay = rawY * adelta + (ay * (1.0 - adelta));
  outputBuffer[7] = abs(ax) & 0x7F;
  if (ax < 0) outputBuffer[7] |= 0x80;
  outputBuffer[8] = abs(ay) & 0x7F;
  if (ay < 0) outputBuffer[8] |= 0x80;
}

void loop() {
  uint8_t tmpBuffer[MAX_INPUT_BUFFER];
  byte i;
    
  updateSensors();
  if ((long)(micros() - nextUpdate) >= 0) {
    nextUpdate += UPDATE_FREQ;
    gatt.setChar(txCharId, outputBuffer, OUTPUT_BUFFER_SIZE);
  }
  gatt.getChar(rxCharId, tmpBuffer, MAX_INPUT_BUFFER);
  if (tmpBuffer[0] != inputCmdId) {
    memcpy(inputBuffer, tmpBuffer, sizeof(tmpBuffer[0])*MAX_INPUT_BUFFER);
    processCmd(inputBuffer);
    inputCmdId = inputBuffer[0];
  }
}
