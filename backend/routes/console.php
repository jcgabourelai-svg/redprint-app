<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('visits:generate-upcoming')->dailyAt('02:00')->withoutOverlapping();
