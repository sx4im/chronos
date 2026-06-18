import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type UploadedImage } from "@shared/schema";
import { RotateCw, Crop, Save, X } from "lucide-react";

interface ImagePreviewModalProps {
  image: UploadedImage;
  onClose: () => void;
  onSave: (updatedImage: UploadedImage) => void;
}

export function ImagePreviewModal({ image, onClose, onSave }: ImagePreviewModalProps) {
  const [rotation, setRotation] = useState(0);
  const [altText, setAltText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleSave = () => {
    // In a real app, you'd apply the rotation and cropping to the image
    // For now, we'll just update the alt text and close
    const updatedImage: UploadedImage = {
      ...image,
      // In a real implementation, you'd have metadata for rotation/crop
    };
    
    onSave(updatedImage);
  };

  const handleCrop = () => {
    // Open crop interface - for now just toggle editing mode
    setIsEditing(!isEditing);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription className="sr-only">
            Preview and adjust your image before using it.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            <img
              src={image.url}
              alt="Preview"
              className="w-full max-h-96 object-contain"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}
            />
            
            {isEditing && (
              <div className="absolute inset-0 border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center">
                <p className="text-primary font-medium">Crop mode - drag to select area</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
            >
              <RotateCw className="mr-2 size-4" />
              Rotate
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCrop}
            >
              <Crop className="mr-2 size-4" />
              {isEditing ? "Exit Crop" : "Crop"}
            </Button>
          </div>

          {/* Alt Text */}
          <div className="space-y-2">
            <Label htmlFor="alt-text">Alt Text (optional)</Label>
            <Input
              id="alt-text"
              placeholder="Describe what's in this image..."
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Help make your content accessible by describing the image content
            </p>
          </div>

          {/* Recognition Results */}
          {image.recognized && image.recognized.length > 0 && (
            <div className="space-y-2">
              <Label>Detected Ingredients</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {image.recognized.map((ingredient, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <span>{ingredient.name}</span>
                    <span className="text-muted-foreground">
                      {Math.round(ingredient.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 size-4" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 size-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}