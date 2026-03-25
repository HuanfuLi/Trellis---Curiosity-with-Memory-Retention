/**
 * Cross-platform audio recording via capacitor-voice-recorder.
 *
 * On Android the plugin routes through the native layer which correctly handles
 * the WebView's onPermissionRequest callback — something navigator.mediaDevices
 * cannot do on its own inside a Capacitor WebView.
 */
import { VoiceRecorder } from 'capacitor-voice-recorder';

export class MicPermissionDeniedError extends Error {
  constructor() {
    super('PERMISSION_DENIED');
  }
}

/**
 * Request permission if needed, then start a recording session.
 * Throws MicPermissionDeniedError when the user denies the microphone prompt.
 * Throws with the plugin error code string for other failures (e.g. MICROPHONE_BEING_USED).
 */
export async function startVoiceRecording(): Promise<void> {
  const { value: hasPerm } = await VoiceRecorder.hasAudioRecordingPermission();
  if (!hasPerm) {
    const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
    if (!granted) throw new MicPermissionDeniedError();
  }
  await VoiceRecorder.startRecording();
}

/**
 * Stop the current recording and return the audio as a Blob.
 * The blob's `type` property reflects the platform's native MIME type
 * (e.g. audio/aac on Android, audio/webm on web).
 */
export async function stopVoiceRecording(): Promise<Blob> {
  const { value } = await VoiceRecorder.stopRecording();
  const { recordDataBase64, mimeType } = value;
  if (!recordDataBase64) throw new Error('EMPTY_RECORDING');
  const byteChars = atob(recordDataBase64);
  const byteNums = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNums], { type: mimeType });
}
