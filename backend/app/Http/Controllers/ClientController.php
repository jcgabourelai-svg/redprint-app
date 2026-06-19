<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    use Sortable;

    public function index(Request $request)
    {
        $query = Client::with(['contracts'])
            ->search($request->search, ['razon_social', 'rfc']);

        $this->applySorting($query, $request, [
            'id', 'razon_social', 'rfc', 'created_at',
        ], 'created_at', 'desc');

        $clients = $query->paginate($request->per_page ?? 15);

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
