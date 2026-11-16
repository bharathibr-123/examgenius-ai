from django.urls import path

from . import views_docs, views_extra, views_plan, views_quiz, views_stats, views_tutor

urlpatterns = [
    path("ai/status/", views_stats.ai_status),
    path("dashboard/", views_stats.dashboard),
    path("analytics/", views_stats.analytics),
    path("readiness/", views_stats.readiness),
    path("gaps/", views_stats.gaps),
    path("learning-dna/", views_stats.learning_dna),
    path("usage/", views_stats.usage),
    path("privacy/", views_stats.privacy),
    # tutor
    path("conversations/", views_tutor.conversations),
    path("conversations/<int:pk>/", views_tutor.conversation_detail),
    path("conversations/<int:pk>/messages/", views_tutor.send_message),
    path("conversations/<int:pk>/check/", views_tutor.doubt_check),
    path("topics/<int:pk>/notes/", views_tutor.topic_notes),
    path("evaluate/", views_tutor.evaluate_answer),
    path("viva/", views_tutor.viva_start),
    path("viva/<int:pk>/", views_tutor.viva_turn),
    # documents
    path("documents/", views_docs.documents),
    path("documents/<int:pk>/", views_docs.document_detail),
    path("documents/<int:pk>/file/", views_docs.document_file),
    path("documents/<int:pk>/page/<int:page>/", views_docs.document_page),
    path("documents/<int:pk>/summary/", views_docs.document_summary),
    path("documents/<int:pk>/ask/", views_docs.document_ask),
    path("documents/<int:pk>/quiz/", views_docs.document_quiz),
    # quizzes
    path("quizzes/", views_quiz.create_quiz),
    path("quizzes/history/", views_quiz.quiz_list),
    path("quizzes/mock/", views_quiz.create_mock),
    path("quizzes/<int:pk>/", views_quiz.quiz_detail),
    path("quizzes/<int:pk>/submit/", views_quiz.submit_quiz),
    path("mistakes/", views_quiz.mistakes),
    path("mistakes/<int:pk>/revise/", views_quiz.revise_mistake),
    path("revision/queue/", views_quiz.revision_queue),
    # planner
    path("plans/", views_plan.plans),
    path("plans/<int:pk>/", views_plan.plan_detail),
    path("plans/<int:pk>/recalculate/", views_plan.plan_recalculate),
    path("plans/rescue-preview/", views_plan.rescue_preview),
    path("tasks/<int:pk>/", views_plan.task_update),
    # new features
    path("papers/", views_extra.papers),
    path("papers/<int:pk>/", views_extra.paper_detail),
    path("focus/", views_extra.focus),
    path("achievements/", views_extra.achievements),
]
