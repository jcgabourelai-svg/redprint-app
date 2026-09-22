<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('visits:generate-upcoming')
    ->dailyAt('02:00')
    ->timezone('America/Cancun')
    ->withoutOverlapping();

// F5: recalculo de planes preventivos entre visitas (02:00) y facturas (02:30).
Schedule::command('maintenance:sync-plans')
    ->dailyAt('02:15')
    ->timezone('America/Cancun')
    ->withoutOverlapping();

Schedule::command('invoices:check-overdue')
    ->dailyAt('02:30')
    ->timezone('America/Cancun')
    ->withoutOverlapping();
