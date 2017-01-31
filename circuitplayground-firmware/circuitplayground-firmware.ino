#include <Adafruit_CircuitPlayground.h>

#define UPDATE_FREQ 50000
#define OUTPUT_BUFFER_SIZE 10
#define MAX_INPUT_BUFFER 16

long nextUpdate;

byte outputBuffer[OUTPUT_BUFFER_SIZE];
byte inputBuffer[MAX_INPUT_BUFFER];

byte CMD_SET_LED = 0x80;
byte CMD_CLEAR_LED = 0x81;

boolean waitForCommand = false;
byte commandSize = 0;
byte commandIndex = 0;

void setup() {
  CircuitPlayground.begin();
  CircuitPlayground.setAccelRange(LIS3DH_RANGE_2_G);
  Serial.begin(9600);
  Serial1.begin(9600);
  nextUpdate = micros() + UPDATE_FREQ;
}

void loop() {
  
  if (Serial1.available() > 0) {
    if (!waitForCommand) {
      inputBuffer[0] = Serial1.read();
      if (inputBuffer[0] == CMD_SET_LED) {
        waitForCommand = true;
        commandSize = 4;
        commandIndex = 1;
      } else if (inputBuffer[0] == CMD_CLEAR_LED) {
        waitForCommand = true;
        commandSize = 1;
        commandIndex = 1;
      }
    } else {
      inputBuffer[commandIndex++] = Serial1.read();
      if (commandIndex >= commandSize) {
        processCmd();
        waitForCommand = false;
      }
    }
  }
  
  updateSensors();
  if ((long) (micros() - nextUpdate) >= 0) {
    Serial1.write(outputBuffer, OUTPUT_BUFFER_SIZE);
    Serial1.write('\n');
    nextUpdate += UPDATE_FREQ;
  }
  delay(1);
}

void processCmd() {
  if (inputBuffer[0] == CMD_SET_LED) {
    if (inputBuffer[1] == 0) {
      for (byte i=0; i<10; i++) {
        CircuitPlayground.setPixelColor(i, inputBuffer[2], inputBuffer[3], inputBuffer[4]);  
      }
    } else {
      CircuitPlayground.setPixelColor(inputBuffer[1]-1, inputBuffer[2], inputBuffer[3], inputBuffer[4]);  
    }
  } else if (inputBuffer[0] == CMD_CLEAR_LED) {
    if (inputBuffer[1] == 0) {
      CircuitPlayground.clearPixels();
    } else {
      CircuitPlayground.setPixelColor(inputBuffer[1]-1, 0, 0, 0);  
    }
  }
}

void updateSensors() {
  int temp, light;
  
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
}
