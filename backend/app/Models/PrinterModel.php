<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PrinterModel extends Model
{
    protected $table = 'printer_models';

    protected $fillable = ['brand_id', 'nombre'];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(PrinterBrand::class, 'brand_id');
    }

    public function articles(): BelongsToMany
    {
        return $this->belongsToMany(Article::class, 'article_printer_model', 'printer_model_id', 'article_id');
    }
}
