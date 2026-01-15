"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Upload, X, Star, Loader2, ImageIcon } from "lucide-react"
import type { ImageUpload } from "@/lib/forum-client"

interface ImageUploaderProps {
    images: ImageUpload[]
    mainImageIndex: number
    onImagesChange: (images: ImageUpload[]) => void
    onMainImageChange: (index: number) => void
    maxImages?: number
    disabled?: boolean
}

export function ImageUploader({
    images,
    mainImageIndex,
    onImagesChange,
    onMainImageChange,
    maxImages = 5,
    disabled = false,
}: ImageUploaderProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const uploadFile = async (file: File): Promise<ImageUpload | null> => {
        try {
            const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
                method: "POST",
                body: file,
            })

            if (!response.ok) {
                throw new Error("Upload failed")
            }

            const blob = await response.json()
            return {
                url: blob.url,
                name: file.name,
            }
        } catch (err) {
            console.error("Upload error:", err)
            return null
        }
    }

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            if (disabled) return

            const fileArray = Array.from(files)
            const remainingSlots = maxImages - images.length

            if (remainingSlots <= 0) {
                setError(`Maximum ${maxImages} images allowed`)
                return
            }

            const filesToUpload = fileArray.slice(0, remainingSlots)
            const validFiles = filesToUpload.filter((file) => {
                if (!file.type.startsWith("image/")) {
                    setError("Only image files are allowed")
                    return false
                }
                if (file.size > 4.5 * 1024 * 1024) {
                    setError("Files must be under 4.5MB")
                    return false
                }
                return true
            })

            if (validFiles.length === 0) return

            setIsUploading(true)
            setError(null)

            const uploadPromises = validFiles.map(uploadFile)
            const results = await Promise.all(uploadPromises)
            const successfulUploads = results.filter((r): r is ImageUpload => r !== null)

            if (successfulUploads.length > 0) {
                onImagesChange([...images, ...successfulUploads])
            }

            if (successfulUploads.length < validFiles.length) {
                setError("Some files failed to upload")
            }

            setIsUploading(false)
        },
        [disabled, images, maxImages, onImagesChange]
    )

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)
            handleFiles(e.dataTransfer.files)
        },
        [handleFiles]
    )

    const handleRemove = useCallback(
        (index: number) => {
            const newImages = images.filter((_, i) => i !== index)
            onImagesChange(newImages)

            // Adjust main image index if needed
            if (mainImageIndex === index) {
                onMainImageChange(0)
            } else if (mainImageIndex > index) {
                onMainImageChange(mainImageIndex - 1)
            }
        },
        [images, mainImageIndex, onImagesChange, onMainImageChange]
    )

    const handleSetMain = useCallback(
        (index: number) => {
            onMainImageChange(index)
        },
        [onMainImageChange]
    )

    return (
        <div className="space-y-3">
            {/* Drop zone */}
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                    isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border",
                    disabled && "opacity-50 cursor-not-allowed",
                    isUploading && "pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    disabled={disabled || isUploading}
                />

                <div className="flex flex-col items-center justify-center text-center cursor-pointer">
                    {isUploading ? (
                        <>
                            <Loader2 className="h-8 w-8 mb-2 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Uploading...</p>
                        </>
                    ) : (
                        <>
                            <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">
                                Drop images here or click to upload
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {images.length}/{maxImages} images • Max 4.5MB each
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Error message */}
            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Image previews */}
            {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {images.map((image, index) => (
                        <div
                            key={image.url}
                            className={cn(
                                "relative aspect-square rounded-lg overflow-hidden border-2 group",
                                mainImageIndex === index
                                    ? "border-primary ring-2 ring-primary/20"
                                    : "border-border/50"
                            )}
                        >
                            <img
                                src={image.url}
                                alt={image.name}
                                className="h-full w-full object-cover"
                            />

                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className={cn(
                                        "h-7 w-7",
                                        mainImageIndex === index && "bg-primary text-primary-foreground"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleSetMain(index)
                                    }}
                                    title="Set as main image"
                                >
                                    <Star className={cn("h-3.5 w-3.5", mainImageIndex === index && "fill-current")} />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemove(index)
                                    }}
                                    title="Remove image"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {/* Main image badge */}
                            {mainImageIndex === index && (
                                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                    <Star className="h-2.5 w-2.5 fill-current" />
                                    Main
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Helper text */}
            {images.length > 0 && images.length > 1 && (
                <p className="text-xs text-muted-foreground">
                    Click the star icon to set the main image that appears on the card
                </p>
            )}
        </div>
    )
}
