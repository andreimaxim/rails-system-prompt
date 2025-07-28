# Active Record, nice and blended

**By Jorge Manrubia**
*December 16, 2022*

Active Record restates the traditional question of how to separate persistence from domain logic: what if you don't have to?

## An impedance-less match

Object–relational impedance mismatch is a fancy way of saying that Object-Oriented languages and relational databases are distinct worlds, and this results in friction when translating concepts between them.

I believe Active Record works so well in practice because it reduces this impedance mismatch to a minimum. There are two main reasons:

- It looks and feels like Ruby, even when you need to go lower level to fine-tune things.
- It comes with fantastic and innovative answers for recurring needs when dealing with objects and relational persistence.

### A perfect Ruby companion

Here's an example from HEY showing the internals of the `Contact#designate_to(box)` method:

```ruby
module Contact::Designatable
  extend ActiveSupport::Concern

  included do
    has_many :designations, class_name: "Box::Designation", dependent: :destroy
  end

  def designate_to(box)
    if box.imbox?
      # Skip designating to Imbox since it's the default.
      undesignate_from(box.identity.boxes)
    else
      update_or_create_designation_to(box)
    end
  end

  def undesignate_from(box)
    designations.destroy_by box: box
  end

  def designation_within(boxes)
    designations.find_by box: boxes
  end

  def designated?(by:)
    designation_within(by.boxes).present?
  end

  private
    def update_or_create_designation_to(box)
      if designation = designation_within(box.identity.boxes)
        designation.update!(box: box)
      else
        designations.create!(box: box)
      end
    end
end
```

### Answers for persistence needs

Active Record offers many options to persist object-oriented models into tables. The author highlights features like:

- Associations
- Single table inheritance
- Serialized attributes
- Enums
- Delegated types

These features help model complex domain concepts without fighting the framework.

## Conclusion

The blend of domain and persistence that Active Record encourages works beautifully in practice. It's a pragmatic approach that reduces complexity while maintaining expressiveness and flexibility.