import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { parseBase64Image } from '@/lib/utils';
import { toast } from 'react-toastify';

interface FileUploadProps {
  onFileSelected: (base64Image: string) => void;
  defaultImageUrl?: string | null;
  className?: string;
}

export function FileUpload({ 
  onFileSelected, 
  defaultImageUrl,
  className = ""
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(defaultImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.type.includes('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    try {
      // Convert file to base64
      const base64Image = await parseBase64Image(file);
      
      // Update preview
      setPreview(base64Image);
      
      // Send to parent component
      onFileSelected(base64Image);
    } catch (error) {
      toast.error('Failed to process the image');
    }
  };

  return (
    <div className={`file-upload ${className}`}>
      <div className="flex items-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
            {preview ? (
              <img 
                src={preview} 
                alt="Profile preview" 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-gray-400 text-xs text-center">No image</div>
            )}
          </div>
        </div>
        
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          className="ml-5"
          onClick={handleButtonClick}
        >
          Change
        </Button>
        
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
