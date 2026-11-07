import { NextRequest, NextResponse } from 'next/server';
import { analyzeWasteWithVision, recordAiWasteLog } from '@/lib/aiVision';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64OrUrl, brandId, ingredientId, productId, station, notes, confirmAndSave } = body;

    if (!imageBase64OrUrl) {
      return NextResponse.json({ error: 'La imagen (Base64 o URL) es requerida para el análisis de visión' }, { status: 400 });
    }

    let effectiveBrandId = brandId;
    if (!effectiveBrandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ error: 'No se encontró una marca activa' }, { status: 400 });
      }
      effectiveBrandId = firstBrand.id;
    }

    // 1. Ejecutar análisis de visión computacional
    const analysis = await analyzeWasteWithVision({
      imageBase64OrUrl,
      brandId: effectiveBrandId,
      ingredientId,
      productId,
      station,
      notes,
    });

    // 2. Si se solicitó confirmación y guardado inmediato
    let savedWasteLog = null;
    if (confirmAndSave && analysis.matchedIngredientId) {
      const matchedIng = await prisma.ingredient.findUnique({
        where: { id: analysis.matchedIngredientId },
      });

      const costPerUnit = matchedIng ? matchedIng.cost : 100;
      const quantity = Number((analysis.estimatedWeightGrams / 1000).toFixed(3));
      const totalCost = Number((quantity * costPerUnit).toFixed(2));

      savedWasteLog = await recordAiWasteLog({
        brandId: effectiveBrandId,
        ingredientId: analysis.matchedIngredientId,
        quantity,
        costPerUnit,
        totalCost,
        reason: `Merma detectada por Visión IA: ${analysis.categoryLabel}`,
        notes: notes || `Análisis automático de IA con ${Math.round(analysis.confidence * 100)}% de confianza`,
        station: analysis.station,
        imageUrl: imageBase64OrUrl.startsWith('data:') ? imageBase64OrUrl.slice(0, 100) + '...[base64]' : imageBase64OrUrl,
        aiCategory: analysis.detectedCategory,
        aiConfidence: analysis.confidence,
        aiDetectedItems: JSON.stringify(analysis.detectedItems),
        aiSuggestions: analysis.correctiveAction,
        aiEstimatedWeightGrams: analysis.estimatedWeightGrams,
        rcaCategory: analysis.detectedCategory,
        correctiveAction: analysis.correctiveAction,
      });
    }

    return NextResponse.json({
      success: true,
      analysis,
      savedWasteLog,
    });
  } catch (error) {
    console.error('Error en /api/ai-vision/analyze-waste:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar la imagen de merma' },
      { status: 500 }
    );
  }
}
