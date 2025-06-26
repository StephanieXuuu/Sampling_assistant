### Words from me
Dear consultants,

This program is designed to assign cases. This is just a demo and created by an intern (which is me). It can only be used to save your time instead of business. 

And this is only a tool, no data would be stored.

Please reach out to me if you find any bug and would like to provide some suggestions of improvements.

Coach: Arya Wang
UI: Shirly Ma 

### Quick User Guide

#### Step 1: Prepare your document:
- A single-sheet Excel (.xlsx) file.

- Every column you may filter on (region, manager, customer level, etc.) must have consistent, case-sensitive values.

- Empty cells are treated as “no value” (they will not match any quota).

### Step 2: Set Parent quotas (first dropdown)
- Pick the column that defines your top-level buckets (e.g. Manager).

- A table lists every unique value plus the number of available rows.

- For each value you can write either:

    - Count — absolute rows (e.g. 30)

    - Ratio — percentage of the available rows (e.g. 50%)

    - Blank = “no limit” – the programme will sample as many as it can.

- Bucket rename (optional)

    - Tick Enable Bucket to map raw values to aliases (e.g. “Kisunla North” → “North”).

    - The sampling engine uses the alias; the original is still stored in the file.
### Step 3: Set Child quotas (second dropdown – optional)
- Select a second column (e.g. Customer Level).

- For every parent value an expandable table appears.

- Fill counts/ratios the same way as above; the programme tries to satisfy child quotas before topping-up the parent total.

### Step 4: Global constraints (optional)
- Click Add Constraint, choose any extra column (e.g. Department).

- For each value type a Count or Ratio.

- If you tick “Enable Bucket”, you can merge raw values into labels here too.

- After sampling the app checks these totals; if they cannot be fully satisfied you’ll see a yellow warning, e.g.

    - ⚠️ Department=Neurology short 53 (taken by Geriatrics +15)

- The file is still produced.

### Step 5: Priority and Generate the sample
- Remember to add priority level under each global constraint
- Press 'Generate' and 'Download' your sample results
- If any condition not satisfied, you can fine-tune by reading through the warning in console

Enjoy the sampling!