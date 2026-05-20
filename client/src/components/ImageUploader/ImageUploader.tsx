import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";
import * as EXIF from "exif-js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiClient, csrfFetch } from "@/lib/apiClient";
import { generateId } from "@/lib/ids";
import { useToast } from "@/hooks/use-toast";
import { type UploadedImage, type IngredientChip } from "@shared/schema";
import { 
  Upload, 
  Camera, 
  X, 
  RotateCw, 
  Crop, 
  Image as ImageIcon,
  Plus,
  Check,
  AlertCircle
} from "lucide-react";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface UploadProgress {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'recognizing' | 'complete' | 'error';
  error?: string;
}

interface ImageUploaderProps {
  maxImages?: number;
  maxSizeMB?: number;
  onUploadComplete: (items: UploadedImage[]) => void;
  onAttach: (imageId: string, chipIndex?: number) => void;
  autoDetect?: boolean;
  accept?: string;
}

interface SignUploadResponse {
  image_id: string;
  uploadUrl: string;
}

interface CompleteUploadResponse {
  success: boolean;
  image_id: string;
  thumbnailUrl: string;
}

interface RecognitionResponse {
  ingredients: string[];
  confidence: number;
}

// Image preprocessing utilities
async function preprocessImage(file: File): Promise<File> {
  try {
    // Get EXIF data to handle orientation
    const exifData = await new Promise<any>((resolve) => {
      EXIF.getData(file as any, function(this: any) {
        resolve(EXIF.getAllTags(this));
      });
    });

    // Compress and resize image
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      preserveExif: false, // Strip EXIF data for privacy
    };

    const compressedFile = await imageCompression(file, options);
    
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("Image preprocessing failed, using original:", error);
    return file;
  }
}

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image data"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(file);
  });
}

function validateImageFile(file: File): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only JPEG, PNG, and WebP images are supported.';
  }
  
  if (file.size > 5 * 1024 * 1024) {
    return 'File is too large. Maximum size is 5MB.';
  }
  
  return null;
}

export function ImageUploader({
  maxImages = 5,
  maxSizeMB = 5,
  onUploadComplete,
  onAttach,
  autoDetect = false,
  accept = "image/*",
}: ImageUploaderProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sign upload mutation
  const signUploadMutation = useMutation<SignUploadResponse, Error, { filename: string; contentType: string; size: number }>({
    mutationFn: async (data) => {
      return apiClient.post('/api/uploads/sign', data);
    },
  });

  // Complete upload mutation
  const completeUploadMutation = useMutation<CompleteUploadResponse, Error, { image_id: string; url: string }>({
    mutationFn: async (data) => {
      return apiClient.post('/api/uploads/complete', data);
    },
  });

  // Recognition mutation
  const recognitionMutation = useMutation<RecognitionResponse, Error, { file: File }>({
    mutationFn: async (data) => {
      const image = await fileToDataUri(data.file);
      const response = await csrfFetch('/api/ingredients/extract', {
        method: 'POST',
        body: JSON.stringify({ image }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || response.statusText);
      }
      return response.json();
    },
  });

  const updateUploadProgress = useCallback((id: string, updates: Partial<UploadProgress>) => {
    setUploads(prev => prev.map(upload => 
      upload.id === id ? { ...upload, ...updates } : upload
    ));
  }, []);

  const simulateUpload = async (uploadId: string, processedFile: File, signedUrl: string) => {
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 20) {
      updateUploadProgress(uploadId, { progress });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // In a real app, you'd actually upload to the signed URL
    // For now, we'll just simulate a successful upload
    return `https://mock-storage.example.com/images/${uploadId}.jpg`;
  };

  const processFile = async (file: File) => {
    const uploadId = generateId();
    
    // Validate file
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: "Upload Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    // Check max images limit
    if (uploads.length + uploadedImages.length >= maxImages) {
      toast({
        title: "Upload Limit Reached",
        description: `Maximum ${maxImages} images allowed.`,
        variant: "destructive",
      });
      return;
    }

    // Add to uploads
    setUploads(prev => [...prev, {
      id: uploadId,
      file,
      progress: 0,
      status: 'processing',
    }]);

    try {
      // Preprocess image
      updateUploadProgress(uploadId, { status: 'processing' });
      const processedFile = await preprocessImage(file);

      // Get signed upload URL
      updateUploadProgress(uploadId, { status: 'uploading' });
      const signResponse = await signUploadMutation.mutateAsync({
        filename: processedFile.name,
        contentType: processedFile.type,
        size: processedFile.size,
      });

      // Simulate upload
      const imageUrl = await simulateUpload(uploadId, processedFile, signResponse.uploadUrl);

      // Complete upload
      const completeResponse = await completeUploadMutation.mutateAsync({
        image_id: signResponse.image_id,
        url: imageUrl,
      });

      // Create uploaded image object
      const uploadedImage: UploadedImage = {
        id: signResponse.image_id,
        url: imageUrl,
        thumbnailUrl: completeResponse.thumbnailUrl,
      };

      // Auto-detect ingredients if enabled
      if (autoDetect) {
        updateUploadProgress(uploadId, { status: 'recognizing' });
        try {
          const recognitionResponse = await recognitionMutation.mutateAsync({
            file: processedFile,
          });
          
          uploadedImage.recognized = recognitionResponse.ingredients.map((name) => ({
            name,
            normalized: name.toLowerCase(),
            confidence: recognitionResponse.confidence,
          }));
        } catch (error) {
          console.warn("Recognition failed:", error);
          // Continue without recognition
        }
      }

      // Add to uploaded images
      setUploadedImages(prev => {
        const newImages = [...prev, uploadedImage];
        onUploadComplete(newImages);
        return newImages;
      });

      updateUploadProgress(uploadId, { status: 'complete' });
      
      // Remove from uploads after a delay
      setTimeout(() => {
        setUploads(prev => prev.filter(upload => upload.id !== uploadId));
      }, 2000);

      toast({
        title: "Upload Complete",
        description: autoDetect && uploadedImage.recognized?.length 
          ? `Found ${uploadedImage.recognized.length} ingredients!`
          : "Image uploaded successfully.",
      });

    } catch (error) {
      updateUploadProgress(uploadId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Upload failed'
      });
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'An error occurred during upload.',
        variant: "destructive",
      });
    }
  };

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach(processFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      onUploadComplete(newImages);
      return newImages;
    });
  };

  const addIngredientFromRecognition = (ingredient: { name: string; normalized: string; confidence: number }, imageId: string) => {
    const chip: IngredientChip = {
      id: generateId(),
      name: ingredient.name,
      imageId,
    };
    onAttach(imageId, undefined);
    toast({
      title: "Ingredient Added",
      description: `Added ${ingredient.name} to your ingredients.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className={cn(
        "border-2 border-dashed transition-colors cursor-pointer",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        uploads.length + uploadedImages.length >= maxImages && "opacity-50 cursor-not-allowed"
      )}>
        <CardContent
          className="p-8 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={uploads.length + uploadedImages.length < maxImages ? openFileSelector : undefined}
        >
          <div className="space-y-4">
            {isDragOver ? (
              <Upload className="size-12 mx-auto text-primary" />
            ) : (
              <Camera className="size-12 mx-auto text-muted-foreground" />
            )}
            
            <div>
              <h3 className="text-lg font-semibold mb-2 text-center">
                {isDragOver ? "Drop images here" : "Snap your Snacks"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Take photos of ingredients or drag and drop images here
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileSelector();
                  }}
                  disabled={uploads.length + uploadedImages.length >= maxImages}
                >
                  <ImageIcon className="mr-2 size-4" />
                  Choose Photos
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCamera();
                  }}
                  disabled={uploads.length + uploadedImages.length >= maxImages}
                >
                  <Camera className="mr-2 size-4" />
                  Take Photo
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                JPEG, PNG, WebP • Max {maxSizeMB}MB • {uploadedImages.length + uploads.length}/{maxImages} images
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        data-testid="camera-input"
      />

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploading...</h4>
          {uploads.map((upload) => (
            <Card key={upload.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate flex-1">
                  {upload.file.name}
                </span>
                <Badge variant={upload.status === 'error' ? 'destructive' : 'secondary'}>
                  {upload.status}
                </Badge>
              </div>
              
              {upload.status !== 'error' && (
                <Progress value={upload.progress} className="h-2" />
              )}
              
              {upload.error && (
                <div className="flex items-center gap-2 mt-2 text-destructive text-sm">
                  <AlertCircle className="size-4" />
                  {upload.error}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Uploaded Images</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {uploadedImages.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="relative">
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt="Uploaded ingredient"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="size-6 p-0"
                      onClick={() => setSelectedImage(image)}
                    >
                      <Crop className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="size-6 p-0"
                      onClick={() => removeImage(image.id)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Recognition Results */}
                {image.recognized && image.recognized.length > 0 && (
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Found ingredients:</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            image.recognized?.forEach(ing => 
                              addIngredientFromRecognition(ing, image.id)
                            );
                          }}
                        >
                          Add All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {image.recognized.map((ingredient, index) => (
                          <Button
                            key={index}
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2 justify-start"
                            onClick={() => addIngredientFromRecognition(ingredient, image.id)}
                          >
                            <Plus className="mr-1 size-3" />
                            {ingredient.name}
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {Math.round(ingredient.confidence * 100)}%
                            </Badge>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreviewModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onSave={(updatedImage) => {
            setUploadedImages(prev => 
              prev.map(img => img.id === updatedImage.id ? updatedImage : img)
            );
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
}
