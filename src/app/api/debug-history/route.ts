/**
 * DEBUG HISTORY - Test product and analysis insertion
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    results.userId = user.id;
    results.email = user.email;

    // Test 1: Check products table structure
    const { data: productColumns, error: productColumnsError } = await supabase
      .from('products')
      .select('*')
      .limit(0);
    
    results.tests.push({
      name: 'Products table access',
      success: !productColumnsError,
      error: productColumnsError?.message,
    });

    // Test 2: Check product_analyses table structure
    const { data: analysisColumns, error: analysisColumnsError } = await supabase
      .from('product_analyses')
      .select('*')
      .limit(0);
    
    results.tests.push({
      name: 'Product analyses table access',
      success: !analysisColumnsError,
      error: analysisColumnsError?.message,
    });

    // Test 3: Count existing products
    const { data: existingProducts, error: countProductsError } = await supabase
      .from('products')
      .select('id, title, url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    results.tests.push({
      name: 'Fetch existing products',
      success: !countProductsError,
      count: existingProducts?.length || 0,
      data: existingProducts,
      error: countProductsError?.message,
    });

    // Test 4: Count existing analyses
    const { data: existingAnalyses, error: countAnalysesError } = await supabase
      .from('product_analyses')
      .select('id, product_id, verdict, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    results.tests.push({
      name: 'Fetch existing analyses',
      success: !countAnalysesError,
      count: existingAnalyses?.length || 0,
      data: existingAnalyses,
      error: countAnalysesError?.message,
    });

    // Test 5: Try inserting a test product
    const testProductUrl = `https://test.aliexpress.com/item/${Date.now()}.html`;
    const { data: insertedProduct, error: insertProductError } = await supabase
      .from('products')
      .insert({
        user_id: user.id,
        url: testProductUrl,
        source: 'aliexpress',
        title: 'DEBUG TEST PRODUCT - DELETE ME',
        description: 'This is a test product for debugging',
        images: [],
        price: 9.99,
        currency: 'USD',
        category: 'test',
        niche: 'custom',
      })
      .select('id')
      .single();
    
    results.tests.push({
      name: 'Insert test product',
      success: !insertProductError,
      productId: insertedProduct?.id,
      error: insertProductError?.message,
      errorDetails: insertProductError?.details,
      errorCode: insertProductError?.code,
    });

    // Test 6: If product inserted, try inserting analysis
    if (insertedProduct?.id) {
      const { data: insertedAnalysis, error: insertAnalysisError } = await supabase
        .from('product_analyses')
        .insert({
          product_id: insertedProduct.id,
          user_id: user.id,
          verdict: 'test',
          confidence_score: 75,
          summary: 'Debug test analysis',
          full_analysis_data: { debug: true, timestamp: Date.now() },
        })
        .select('id')
        .single();
      
      results.tests.push({
        name: 'Insert test analysis',
        success: !insertAnalysisError,
        analysisId: insertedAnalysis?.id,
        error: insertAnalysisError?.message,
        errorDetails: insertAnalysisError?.details,
        errorCode: insertAnalysisError?.code,
      });

      // Cleanup: Delete test analysis
      if (insertedAnalysis?.id) {
        await supabase
          .from('product_analyses')
          .delete()
          .eq('id', insertedAnalysis.id);
        results.tests.push({ name: 'Cleanup test analysis', success: true });
      }

      // Cleanup: Delete test product
      await supabase
        .from('products')
        .delete()
        .eq('id', insertedProduct.id);
      results.tests.push({ name: 'Cleanup test product', success: true });
    }

    // Test 7: Check if product_analyses has foreign key constraint issues
    const { data: orphanAnalyses, error: orphanError } = await supabase
      .from('product_analyses')
      .select('id, product_id')
      .eq('user_id', user.id)
      .limit(10);

    if (!orphanError && orphanAnalyses && orphanAnalyses.length > 0) {
      // Check if the product_ids exist
      const productIds = orphanAnalyses.map(a => a.product_id);
      const { data: existingProductIds, error: existingError } = await supabase
        .from('products')
        .select('id')
        .in('id', productIds);
      
      const existingSet = new Set(existingProductIds?.map(p => p.id) || []);
      const orphanedAnalyses = orphanAnalyses.filter(a => !existingSet.has(a.product_id));
      
      results.tests.push({
        name: 'Check for orphaned analyses',
        totalAnalyses: orphanAnalyses.length,
        orphanedCount: orphanedAnalyses.length,
        orphanedProductIds: orphanedAnalyses.map(a => a.product_id),
      });
    }

    // Overall status
    results.allTestsPassed = results.tests.every((t: any) => t.success !== false);

    return NextResponse.json(results);
  } catch (error: any) {
    results.error = error.message;
    results.stack = error.stack;
    return NextResponse.json(results, { status: 500 });
  }
}

