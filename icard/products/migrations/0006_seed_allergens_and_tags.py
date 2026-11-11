from django.db import migrations

ALLERGENS = (
    'Gluten',
    'Crustáceos',
    'Huevo',
    'Pescado',
    'Maní',
    'Soja',
    'Lácteos',
    'Frutos secos',
    'Apio',
    'Mostaza',
    'Sésamo',
    'Sulfitos',
    'Altramuces',
    'Moluscos',
)
TAGS = ('Vegano', 'Vegetariano', 'Sin gluten', 'Picante', 'Recomendado')
SEEDS = (('Allergen', ALLERGENS), ('Tag', TAGS))


def seed(apps, schema_editor):
    for model_name, names in SEEDS:
        model = apps.get_model('products', model_name)
        for position, name in enumerate(names):
            if not model.objects.filter(name__iexact=name).exists():
                model.objects.create(name=name, position=position)


def unseed(apps, schema_editor):
    for model_name, names in SEEDS:
        apps.get_model('products', model_name).objects.filter(name__in=names, products__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0005_allergen_tag_product_labels'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
