"""Seed the database with sample data."""
from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app.models import User, Question, Interview, Feedback, Panel, PanelMember
from app.auth import get_password_hash


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(User).count() > 0:
        print("Database already seeded.")
        db.close()
        return

    # Create users
    users = [
        User(
            email="admin@interviewhub.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Sarah Johnson",
            role="admin",
            phone="+1-555-0101",
        ),
        User(
            email="interviewer1@interviewhub.com",
            hashed_password=get_password_hash("password123"),
            full_name="Michael Chen",
            role="interviewer",
            phone="+1-555-0102",
        ),
        User(
            email="interviewer2@interviewhub.com",
            hashed_password=get_password_hash("password123"),
            full_name="Emily Rodriguez",
            role="interviewer",
            phone="+1-555-0103",
        ),
        User(
            email="candidate1@email.com",
            hashed_password=get_password_hash("password123"),
            full_name="Alex Thompson",
            role="candidate",
            phone="+1-555-0201",
        ),
        User(
            email="candidate2@email.com",
            hashed_password=get_password_hash("password123"),
            full_name="Priya Patel",
            role="candidate",
            phone="+1-555-0202",
        ),
        User(
            email="candidate3@email.com",
            hashed_password=get_password_hash("password123"),
            full_name="James Wilson",
            role="candidate",
            phone="+1-555-0203",
        ),
        User(
            email="candidate4@email.com",
            hashed_password=get_password_hash("password123"),
            full_name="Lisa Zhang",
            role="candidate",
            phone="+1-555-0204",
        ),
    ]
    for u in users:
        db.add(u)
    db.commit()

    # Create questions
    questions = [
        Question(
            title="Two Sum",
            description="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
            difficulty="easy",
            category="Arrays",
            tags="array,hash-table",
            sample_input="nums = [2,7,11,15], target = 9",
            sample_output="[0,1]",
            solution="def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i",
            time_limit_minutes=20,
        ),
        Question(
            title="Reverse Linked List",
            description="Given the head of a singly linked list, reverse the list, and return the reversed list.\n\nImplement both iterative and recursive solutions.",
            difficulty="easy",
            category="Linked Lists",
            tags="linked-list,recursion",
            sample_input="head = [1,2,3,4,5]",
            sample_output="[5,4,3,2,1]",
            solution="def reverseList(head):\n    prev = None\n    current = head\n    while current:\n        next_node = current.next\n        current.next = prev\n        prev = current\n        current = next_node\n    return prev",
            time_limit_minutes=15,
        ),
        Question(
            title="Valid Parentheses",
            description="Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
            difficulty="easy",
            category="Stacks",
            tags="stack,string",
            sample_input='s = "()[]{}"',
            sample_output="true",
            time_limit_minutes=15,
        ),
        Question(
            title="Longest Substring Without Repeating Characters",
            description="Given a string s, find the length of the longest substring without repeating characters.\n\nExplain your approach and time complexity.",
            difficulty="medium",
            category="Strings",
            tags="string,sliding-window,hash-table",
            sample_input='s = "abcabcbb"',
            sample_output="3",
            time_limit_minutes=25,
        ),
        Question(
            title="Binary Tree Level Order Traversal",
            description="Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
            difficulty="medium",
            category="Trees",
            tags="tree,bfs,queue",
            sample_input="root = [3,9,20,null,null,15,7]",
            sample_output="[[3],[9,20],[15,7]]",
            time_limit_minutes=25,
        ),
        Question(
            title="Merge K Sorted Lists",
            description="You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.\n\nDiscuss the time and space complexity of your solution.",
            difficulty="hard",
            category="Linked Lists",
            tags="linked-list,heap,divide-and-conquer",
            sample_input="lists = [[1,4,5],[1,3,4],[2,6]]",
            sample_output="[1,1,2,3,4,4,5,6]",
            time_limit_minutes=35,
        ),
        Question(
            title="System Design: URL Shortener",
            description="Design a URL shortening service like TinyURL.\n\nRequirements:\n- Given a long URL, generate a short unique URL\n- Given a short URL, redirect to the original URL\n- Handle high traffic (100M URLs/day)\n- URLs should expire after a configurable time\n\nDiscuss:\n1. API design\n2. Database schema\n3. URL generation algorithm\n4. Caching strategy\n5. Scalability considerations",
            difficulty="medium",
            category="System Design",
            tags="system-design,distributed-systems",
            time_limit_minutes=45,
        ),
        Question(
            title="LRU Cache",
            description="Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class:\n- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.\n- int get(int key) Return the value of the key if the key exists, otherwise return -1.\n- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache.\n\nIf the number of keys exceeds the capacity, evict the least recently used key.",
            difficulty="hard",
            category="Data Structures",
            tags="hash-table,linked-list,design",
            sample_input="[\"LRUCache\",\"put\",\"put\",\"get\",\"put\",\"get\"]\n[[2],[1,1],[2,2],[1],[3,3],[2]]",
            sample_output="[null,null,null,1,null,-1]",
            time_limit_minutes=30,
        ),
    ]
    for q in questions:
        db.add(q)
    db.commit()

    # Create interviews
    now = datetime.utcnow()
    interviews = [
        Interview(
            title="Senior Frontend Developer - Round 1",
            description="Technical coding interview focusing on JavaScript and React fundamentals",
            interviewer_id=2,
            candidate_id=4,
            scheduled_at=now + timedelta(hours=2),
            duration_minutes=60,
            status="scheduled",
            meeting_link="https://meet.interviewhub.com/abc123",
        ),
        Interview(
            title="Backend Engineer - Technical Screen",
            description="Python and system design interview",
            interviewer_id=3,
            candidate_id=5,
            scheduled_at=now + timedelta(days=1, hours=3),
            duration_minutes=90,
            status="scheduled",
            meeting_link="https://meet.interviewhub.com/def456",
        ),
        Interview(
            title="Full Stack Developer - Coding Challenge",
            description="Live coding session with algorithmic problems",
            interviewer_id=2,
            candidate_id=6,
            scheduled_at=now - timedelta(days=1),
            duration_minutes=60,
            status="completed",
        ),
        Interview(
            title="Data Engineer - System Design",
            description="System design and architecture discussion",
            interviewer_id=3,
            candidate_id=7,
            scheduled_at=now - timedelta(days=3),
            duration_minutes=45,
            status="completed",
        ),
        Interview(
            title="ML Engineer - Algorithm Round",
            description="Machine learning concepts and coding",
            interviewer_id=2,
            candidate_id=5,
            scheduled_at=now + timedelta(days=3),
            duration_minutes=60,
            status="scheduled",
        ),
    ]
    for interview in interviews:
        db.add(interview)
    db.commit()

    # Create feedback for completed interviews
    feedbacks = [
        Feedback(
            interview_id=3,
            reviewer_id=2,
            technical_score=4.2,
            communication_score=4.5,
            problem_solving_score=3.8,
            overall_score=4.1,
            strengths="Strong React knowledge, clean code practices, good communication",
            weaknesses="Could improve on algorithm optimization",
            comments="Solid candidate overall. Demonstrated good understanding of React hooks and state management.",
            recommendation="hire",
        ),
        Feedback(
            interview_id=4,
            reviewer_id=3,
            technical_score=3.5,
            communication_score=4.0,
            problem_solving_score=3.2,
            overall_score=3.5,
            strengths="Good understanding of distributed systems concepts",
            weaknesses="Needs to improve on database optimization and indexing strategies",
            comments="Decent understanding of system design but needs more depth in specific areas.",
            recommendation="next_round",
        ),
    ]
    for f in feedbacks:
        db.add(f)
    db.commit()

    # Create panels
    panels = [
        Panel(
            name="Frontend Engineering Panel",
            description="Panel for evaluating frontend engineering candidates on React, JavaScript, CSS, and UI/UX skills",
        ),
        Panel(
            name="Backend Engineering Panel",
            description="Panel for evaluating backend engineering candidates on Python, APIs, databases, and system design",
        ),
        Panel(
            name="Full Stack Panel",
            description="Cross-functional panel for evaluating full stack developer candidates",
        ),
    ]
    for p in panels:
        db.add(p)
    db.commit()

    # Add panel members
    panel_members = [
        PanelMember(panel_id=1, user_id=1, role_in_panel="lead"),
        PanelMember(panel_id=1, user_id=2, role_in_panel="member"),
        PanelMember(panel_id=2, user_id=1, role_in_panel="lead"),
        PanelMember(panel_id=2, user_id=3, role_in_panel="member"),
        PanelMember(panel_id=3, user_id=2, role_in_panel="member"),
        PanelMember(panel_id=3, user_id=3, role_in_panel="member"),
    ]
    for pm in panel_members:
        db.add(pm)
    db.commit()

    db.close()
    print("Database seeded successfully!")


if __name__ == "__main__":
    seed_database()
