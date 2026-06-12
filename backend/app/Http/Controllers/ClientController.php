<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $clients = Client::with(['contracts'])
            ->when($request->search, function ($q, $s) {
                $q->where(function ($query) use ($s) {
                    $query->where('razon_social', 'ilike', "%{$s}%")
                        ->orWhere('rfc', 'ilike', "%{$s}%");
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return ClientResource::collection($clients);
    }

    public function show(Client $client): ClientResource
    {
        $client->load(['contracts.printers', 'contracts' => fn($q) => $q->orderBy('created_at', 'desc')]);
        return new ClientResource($client);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['creado_por'] = $request->user()->id;
        $data['fecha_creacion'] = now();

        $client = Client::create($data);
        return response()->json(new ClientResource($client), 201);
    }

    public function update(StoreClientRequest $request, Client $client): ClientResource
    {
        $client->update($request->validated());
        return new ClientResource($client->fresh());
    }
}
