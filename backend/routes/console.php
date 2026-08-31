<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('visits:generate-upcoming')
    ->dailyAt('02:00')
    ->timezone('America/Cancun')
    ->withoutOverlapping();

Schedule::command('invoices:check-overdue')
    ->dailyAt('02:30')
    ->timezone('America/Cancun')
    ->withoutOverlapping();
