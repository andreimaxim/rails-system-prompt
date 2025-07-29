# Fractal Journeys

**By Jorge Manrubia**
*September 18, 2022*

## Introduction

"Good code is a fractal: you observe the same qualities repeated at different levels of abstraction."

The article explores the concept of writing understandable code through fractal-like qualities. The author suggests that good code follows consistent patterns across different levels of abstraction.

## Key Qualities of Good Code

The author identifies four essential qualities for making code understandable:

1. Domain-Driven: Speak the language of the problem domain
2. Encapsulation: Expose clear interfaces and hide implementation details
3. Cohesiveness: Focus on a single responsibility
4. Symmetry: Operate at the same level of abstraction

## Code Example: Event Relaying in Basecamp

The article walks through a code example from Basecamp's event relaying system, demonstrating these principles:

```ruby
class Event < ApplicationRecord
  include Relaying
end

module Event::Relaying
  def relay_now
    relay_to_or_revoke_from_timeline
    relay_to_webhooks_later
    relay_to_customer_tracking_later

    if recording
      relay_to_readers
      relay_to_appearants
      relay_to_recipients
      relay_to_schedule
    end
  end

  private

  def relay_to_or_revoke_from_timeline
    if bucket.timelined?
      ::Timeline::Relayer.new(self).relay
      ::Timeline::Revoker.new(self).revoke
    end
  end
end
```

## Conclusion

The author argues that the ability to navigate complex code systems with ease is the most important quality of good code. By maintaining consistent abstraction, clear naming, and focused responsibilities, code becomes more understandable and maintainable.