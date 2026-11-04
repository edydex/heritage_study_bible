"""Transfer complete, exact publisher phrases while retaining all source spans."""
import re

STOP = set('a an the and or but for to of in on at by as with from into is are was were be been being am i me my we us our you your he him his she her it its they them their this that these those who whom which what when where how not no all any every both each have has had do does did so if than then also'.split())


def words(text):
    return [(match[0].lower().replace('’', "'"), match.start(), match.end())
            for match in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", text)]


def transfer_groups(groups, source_english, target_english):
    publisher_words, target_words = words(source_english), words(target_english)
    publisher_sequence = [word[0] for word in publisher_words]
    target_sequence = [word[0] for word in target_words]
    identical = publisher_sequence == target_sequence
    result = []
    for group in groups:
        ranges = []
        for start, end in group.get('targetRanges', [group['target']]):
            indexes = [i for i, (_, a, b) in enumerate(publisher_words) if start <= a and end >= b]
            if not indexes:
                break
            phrase = publisher_sequence[indexes[0]:indexes[-1] + 1]
            if identical:
                position = indexes[0]
            else:
                # A split phrase is transferred only if every full segment is
                # unique in both editions and has lexical content of its own.
                if not any(word not in STOP for word in phrase):
                    break
                old_positions = [i for i in range(len(publisher_sequence)) if publisher_sequence[i:i + len(phrase)] == phrase]
                positions = [i for i in range(len(target_sequence)) if target_sequence[i:i + len(phrase)] == phrase]
                if len(old_positions) != 1 or len(positions) != 1:
                    break
                position = positions[0]
            ranges.append([target_words[position][1], target_words[position + len(phrase) - 1][2]])
        else:
            ranges.sort()
            # Study heads belong to the reviewed wording and offsets of one
            # translation. A transferred phrase needs its own head review.
            transferred={key:value for key,value in group.items() if key!='studyHeads'}
            result.append({**transferred, 'target': ranges[0], 'targetRanges': ranges, 'method': 'exact-shared-publisher-phrase'})
    # Refuse overlaps between complete groups rather than choosing a partial
    # segment or silently assigning the same translated word twice.
    return [group for group in result if not any(
        other is not group and a < y and b > x
        for other in result for a, b in group['targetRanges'] for x, y in other['targetRanges'])]
