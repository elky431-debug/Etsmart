import { supabase } from '../supabase';
import type { SupplierProduct, ProductAnalysis } from '@/types';

// Product operations
export const productDb = {
  // Get all products for a user
  async getProducts(userId: string): Promise<SupplierProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformProductFromDb);
  },

  // Get a single product
  async getProduct(productId: string, userId: string): Promise<SupplierProduct | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return transformProductFromDb(data);
  },

  // Create a new product
  async createProduct(userId: string, product: SupplierProduct): Promise<SupplierProduct> {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert({
        user_id: userId,
        url: product.url,
        source: product.source,
        title: product.title,
        description: product.description,
        images: product.images,
        price: product.price,
        currency: product.currency,
        category: product.category,
        shipping_time: product.shippingTime,
        min_order_quantity: product.minOrderQuantity,
        supplier_rating: product.supplierRating,
        niche: product.category, // Adjust based on your logic
      })
      .select()
      .single();

    if (productError) throw productError;

    // Insert variants if any
    if (product.variants && product.variants.length > 0) {
      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(
          product.variants.map((variant) => ({
            product_id: productData.id,
            name: variant.name,
            price: variant.price,
            image: variant.image,
          }))
        );

      if (variantsError) throw variantsError;
    }

    // Fetch the complete product with variants
    return this.getProduct(productData.id, userId) as Promise<SupplierProduct>;
  },

  // Update a product
  async updateProduct(
    productId: string,
    userId: string,
    updates: Partial<SupplierProduct>
  ): Promise<SupplierProduct> {
    const { error } = await supabase
      .from('products')
      .update({
        title: updates.title,
        description: updates.description,
        images: updates.images,
        price: updates.price,
        currency: updates.currency,
        category: updates.category,
        shipping_time: updates.shippingTime,
        min_order_quantity: updates.minOrderQuantity,
        supplier_rating: updates.supplierRating,
      })
      .eq('id', productId)
      .eq('user_id', userId);

    if (error) throw error;

    return this.getProduct(productId, userId) as Promise<SupplierProduct>;
  },

  // Delete a product
  async deleteProduct(productId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('user_id', userId);

    if (error) throw error;
  },
};

// Transform database product to app product type
function transformProductFromDb(dbProduct: any): SupplierProduct {
  return {
    id: dbProduct.id,
    url: dbProduct.url,
    source: dbProduct.source,
    title: dbProduct.title,
    description: dbProduct.description || '',
    images: dbProduct.images || [],
    price: parseFloat(dbProduct.price),
    currency: dbProduct.currency || 'USD',
    variants: dbProduct.product_variants?.map((v: any) => ({
      id: v.id,
      name: v.name,
      price: parseFloat(v.price),
      image: v.image,
    })) || [],
    category: dbProduct.category || '',
    shippingTime: dbProduct.shipping_time || '',
    minOrderQuantity: dbProduct.min_order_quantity || 1,
    supplierRating: dbProduct.supplier_rating ? parseFloat(dbProduct.supplier_rating) : 0,
    createdAt: new Date(dbProduct.created_at),
  };
}












