# Vanilla Rails is plenty

**By Jorge Manrubia**
*November 8, 2022*

A common critique of Rails is that it encourages a poor separation of concerns. That when things get serious, you need an alternative that brings the missing pieces. We disagree.

## We don't distinguish application and domain layers

We don't separate application-level and domain-level artifacts. Instead, we have a set of domain models (both Active Records and POROs) exposing public interfaces to be invoked from the system boundaries, typically controllers or jobs.

## Controllers access domain models directly

We are fine with plain CRUD accesses from controllers for simple scenarios. For example, creating boosts in Basecamp:

```ruby
class BoostsController < ApplicationController
  def create
    @boost = @boostable.boosts.create!(content: params[:boost][:content])
  end
end
```

More often, we perform these accesses through methods exposed by domain models:

```ruby
class Boxes::DesignationsController < ApplicationController
  def create
    @contact.designate_to(@box)

    respond_to do |format|
      format.html { refresh_or_redirect_back_or_to @contact, notice: "Changes saved. This might take a few minutes to complete." }
      format.json { head :created }
    end
  end
end
```

## Rich domain models

We encourage building _rich_ domain models. We use two tactics to avoid fat model problems:

1. Using concerns to organize model's code
2. Delegating functionality to additional systems of objects

Example with a `Recording` model:

```ruby
class Recording < ApplicationRecord
  include Incineratable, Copyable
end

module Recording::Incineratable
  def incinerate
    Incineration.new(self).run
  end
end

module Recording::Copyable
  def copy_to(bucket, parent: nil)
    copies.create! destination_bucket: bucket, destination_parent: parent
  end
end
```

## Conclusion

In their experience, this approach with vanilla Rails results in maintainable large Rails applications. As a recent example, Basecamp 4 was built on top of Basecamp 3's codebase using this philosophy.