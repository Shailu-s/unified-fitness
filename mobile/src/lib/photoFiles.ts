import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { capturePhoto, stripJpegMetadata, validateOwnedPhotoUri, validatePhotoBytes, type PickedPhoto } from './photos';

const directory = () => new Directory(Paths.document, 'meal-photos');

async function prepare(asset: PickedPhoto) {
  if (!asset.width || !asset.height || asset.width * asset.height > 60000000) throw new Error('Photo resolution is too large. Choose a smaller image.');
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1280) context.resize(asset.width >= asset.height ? { width: 1280, height: null } : { width: null, height: 1280 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return new File(saved.uri).bytes();
}

async function persist(bytes: Uint8Array) {
  const folder = directory();
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `${Crypto.randomUUID()}.jpg`);
  file.create();
  file.write(bytes);
  return file.uri;
}

export async function prepareMealPhoto(asset: PickedPhoto): Promise<string> {
  const uri = await capturePhoto('gallery', { permission: async () => true, pick: async () => asset, prepare, persist });
  if (!uri) throw new Error('Photo unavailable.');
  return uri;
}

export async function pickMealPhoto(source: 'camera' | 'gallery'): Promise<string | null> {
  return capturePhoto(source, {
    permission: async () => (await ImagePicker.requestCameraPermissionsAsync()).granted,
    pick: async (kind) => {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, exif: false, quality: 1 };
      const result = kind === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      return result.canceled ? null : result.assets[0];
    },
    prepare, persist,
  });
}

export async function photoUploadData(uri: string) {
  validateOwnedPhotoUri(uri, directory().uri);
  const bytes = stripJpegMetadata(await new File(uri).bytes());
  validatePhotoBytes(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { bytes, sha256 };
}

export function removeLocalPhoto(uri: string) {
  validateOwnedPhotoUri(uri, directory().uri);
  const file = new File(uri);
  if (file.exists) file.delete();
}
