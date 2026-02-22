"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework.routers import DefaultRouter
from inventory.views import (
    ProductTypeViewSet, HSNViewSet, ProductViewSet, BatchViewSet,
    InvoiceViewSet, InvoiceItemViewSet,
    SalesBillViewSet, PurchaseBillViewSet, ShopProfileViewSet, WholesalerViewSet,
)
import os


# 👇 DESKTOP PRODUCTION: Serve React SPA
def serve_react_file(request, path_str='index.html'):
    """Serve React frontend files with fallback to index.html for SPA routing"""
    frontend_dist = os.path.join(settings.BASE_DIR.parent, 'frontend', 'dist')
    file_path = os.path.join(frontend_dist, path_str)
    
    # Security: prevent directory traversal
    file_path = os.path.normpath(file_path)
    if not file_path.startswith(os.path.normpath(frontend_dist)):
        return HttpResponse('Not Found', status=404)
    
    # If file exists, serve it
    if os.path.isfile(file_path):
        with open(file_path, 'rb') as f:
            content = f.read()
        return HttpResponse(content, content_type=get_content_type(file_path))
    
    # Otherwise serve index.html for SPA routing
    index_path = os.path.join(frontend_dist, 'index.html')
    if os.path.isfile(index_path):
        with open(index_path, 'rb') as f:
            content = f.read()
        return HttpResponse(content, content_type='text/html')
    
    return HttpResponse('Frontend not built. Run: cd frontend && npm run build', status=404)


def get_content_type(file_path):
    """Determine content type based on file extension"""
    ext_map = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
    }
    _, ext = os.path.splitext(file_path)
    return ext_map.get(ext, 'application/octet-stream')

# Create API router
router = DefaultRouter()
router.register(r'product-types', ProductTypeViewSet, basename='producttype')
router.register(r'hsn', HSNViewSet, basename='hsn')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'batches', BatchViewSet, basename='batch')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'invoice-items', InvoiceItemViewSet, basename='invoiceitem')
router.register(r'sales-bills', SalesBillViewSet, basename='salesbill')
router.register(r'purchase-bills', PurchaseBillViewSet, basename='purchasebill')
router.register(r'shop-profile', ShopProfileViewSet, basename='shopprofile')
router.register(r'wholesalers', WholesalerViewSet, basename='wholesaler')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include(router.urls)),
    
    # 👇 DESKTOP PRODUCTION: Serve React frontend and static files
    # API routes take precedence, then static files, then fallback to React SPA
    path('static/<path:filepath>', serve_react_file, name='static'),
    path('<path:path_str>', serve_react_file, name='frontend'),
    path('', serve_react_file, name='home'),
]
