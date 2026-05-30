import { v2 as cloudinary } from "cloudinary";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
    secure: true
  });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

export async function uploadImageBuffer(
  buffer: Buffer,
  mimeType: string,
  publicIdPrefix: string
): Promise<string> {
  configureCloudinary();

  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "telehealth/avatars",
    public_id: `${publicIdPrefix}-${Date.now()}`,
    overwrite: true,
    resource_type: "image"
  });

  return result.secure_url;
}
