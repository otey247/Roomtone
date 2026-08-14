import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateDeviceReadiness,
  isSamsungS24Ultra,
  type DeviceReadinessInput
} from '../../src/domain/device-readiness.ts';

const readyInput: DeviceReadinessInput = {
  platform: 'android',
  physicalDevice: true,
  manufacturer: 'samsung',
  modelName: 'SM-S928U1',
  designName: 'e3q',
  productName: 'e3qsqw',
  nativeWhisperAvailable: true,
  microphonePermission: 'granted',
  documentStorageAvailable: true,
  activeSpeechModelInstalled: true,
  vadModelInstalled: true
};

test('recognizes Samsung Galaxy S24 Ultra model identifiers', () => {
  assert.equal(isSamsungS24Ultra(readyInput), true);
  assert.equal(isSamsungS24Ultra({
    manufacturer: 'Samsung',
    modelName: 'Galaxy S24 Ultra',
    designName: null,
    productName: null
  }), true);
});

test('marks a fully configured S24 Ultra as native-meeting ready', () => {
  const result = evaluateDeviceReadiness(readyInput);
  assert.equal(result.targetDeviceDetected, true);
  assert.equal(result.nativeMeetingReady, true);
  assert.equal(result.checks.every((check) => check.status === 'ready'), true);
});

test('blocks native readiness when the APK lacks the native speech module', () => {
  const result = evaluateDeviceReadiness({
    ...readyInput,
    nativeWhisperAvailable: false
  });
  assert.equal(result.nativeMeetingReady, false);
  assert.equal(result.checks.find((check) => check.id === 'native-whisper')?.status, 'blocked');
});
