
# CLAUDE.md - Rails app

## Code style guide

### Use idiomatic and eloquent Ruby

❌ DON'T:

```ruby
array = []
for i in 0..10
  array.push(i * 2)
end
```

✅ DO:

```ruby
array = (0..10).map { |i| i * 2 }
```

### Lean on Rails built-in tools

❌ DON'T:

```ruby
def validate_email
  if !email.match(/\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)*\.[a-z]+\z/i)
    errors.add(:email, "is invalid")
  end
end
```

✅ DO:

```ruby
validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
```

### Use RESTful routes

❌ DON'T:

```ruby
# routes.rb
post 'events/:id/register_attendee', to: 'events#register_attendee'
post 'events/:id/cancel_registration', to: 'events#cancel_registration'
```

✅ DO:

```ruby
# routes.rb
resources :events do
  resources :registrations, only: [:create, :destroy]
end
```

### Use concerns for model aspects

❌ DON'T:

```ruby
class Event < ApplicationRecord
  def soft_delete
    update(deleted_at: Time.current)
  end

  def restore
    update(deleted_at: nil)
  end
end
```

✅ DO:

```ruby
# app/models/concerns/soft_deletable.rb
module SoftDeletable
  extend ActiveSupport::Concern

  included do
    scope :active, -> { where(deleted_at: nil) }
  end

  def soft_delete
    update(deleted_at: Time.current)
  end
end

# app/models/event.rb
class Event < ApplicationRecord
  include SoftDeletable
end
```

### Avoid service objects

❌ DON'T:

```ruby
class EventRegistrationService
  def self.register(event, user)
    # registration logic
  end
end
```

✅ DO:

```ruby
class Registration < ApplicationRecord
  belongs_to :event
  belongs_to :user

  validates :event, presence: true
  validate :event_has_capacity

  private

  def event_has_capacity
    errors.add(:event, "is full") unless event.has_capacity?
  end
end
```

### Test Writing Guidelines

CRITICAL: Test names must describe business scenarios, NOT method names.
The test names need to use natural English when describing the scenario.

❌ NEVER write tests like:

```ruby
test "schedule_on_date returns an empty array"
test "available_slots returns nil when closed"
test "create_booking returns false when invalid"
```

✅ ALWAYS write tests like:

```ruby
test "schedule has no available slots when current time is after closing time"
test "no slots are available on holidays"
test "booking cannot be created when participant limit is exceeded"
```

Pattern: `test "[what happens] when [business scenario]"`
