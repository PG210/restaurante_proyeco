from django.core.files.base import ContentFile
from rest_framework import serializers

from icard.media import InvalidImageError, optimize_image


class OptimizedImageMixin:
    def validate_image(self, image) -> ContentFile:
        try:
            return optimize_image(image)
        except InvalidImageError as error:
            raise serializers.ValidationError(str(error)) from error
