<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeUserAdmin extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:make-admin {email} {--revoke : Remove admin instead of granting it}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Grant (or revoke) admin privileges for a user by email';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->argument('email');
        $revoke = $this->option('revoke');

        $user = User::where('email', $email)->first();

        if (! $user) {
            $this->error("No user found with email: {$email}");
            return self::FAILURE;
        }

        $user->is_admin = ! $revoke;
        $user->save();

        $this->info(sprintf(
            'User "%s" (%s) is now %s.',
            $user->name,
            $user->email,
            $revoke ? 'a regular user' : 'an admin'
        ));

        return self::SUCCESS;
    }
}
