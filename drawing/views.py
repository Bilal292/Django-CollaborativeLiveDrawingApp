from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.decorators import login_required
from .models import Drawing, UserDrawInk
import json
from django.http import JsonResponse
from django.utils import timezone
from datetime import timedelta
from django.core.paginator import Paginator

import stripe
from django.conf import settings

# Set up Stripe API key
stripe.api_key = settings.STRIPE_SECRET_KEY

def index(request):
    user_ink = None
    next_claim_time = None
    
    # Check if the user is logged in and retrieve their ink data
    if request.user.is_authenticated:
        user_ink, created = UserDrawInk.objects.get_or_create(user=request.user)
        
        if user_ink.last_claim_time:
            # Calculate when the user can next claim ink (8-hour interval)
            claim_interval = timedelta(hours=8)
            next_claim_time = user_ink.last_claim_time + claim_interval
            
            # If the next claim time is in the past, set it to now
            if next_claim_time < timezone.now():
                next_claim_time = timezone.now()
        else:
            # For new users or those without a last claim time
            next_claim_time = None
        
        # Save the updated user_ink instance
        user_ink.save()

    return render(request, 'drawing/index.html', {
        'user_ink': user_ink,
        'next_claim_time': next_claim_time.isoformat() if next_claim_time else 'None',
        'stripe_public_key': settings.STRIPE_PUBLIC_KEY,
    })

def user_register(request):
    if request.method == 'POST':
        # Create an instance of UserCreationForm with the submitted data
        form = UserCreationForm(request.POST)

        # If the form is valid - Save the new user to the database
        if form.is_valid():
            user = form.save()

            # Create a UserDrawInk instance associated with the new user
            UserDrawInk.objects.create(user=user)

            login(request, user) # Log the user in, starting a session for them
            return redirect('index')
    else:
        # If the request method is not POST (e.g., GET), create a new empty form for user registration
        form = UserCreationForm()

    # Render the registration template, passing the form to the context for rendering in the template
    return render(request, 'drawing/register.html', {'form': form})

def user_login(request):
    if request.method == 'POST':
        # Create an instance of AuthenticationForm with the submitted data
        form = AuthenticationForm(request, data=request.POST)

        # If the form is valid - Retrieve the user object, and Log the user in
        if form.is_valid():

            user = form.get_user()
            login(request, user)

            # Create a UserDrawInk object for the user if it doesn't exist
            UserDrawInk.objects.get_or_create(user=user)

            return redirect('index')
    else:
         # If the request method is not POST, create an empty AuthenticationForm
        form = AuthenticationForm()

    return render(request, 'drawing/login.html', {'form': form})

def user_logout(request):
    logout(request)
    return redirect('index')

@login_required
def claim_ink(request):
    if request.method == 'POST':
        # Get or create a UserDrawInk object for the currently logged-in user
        user_ink, created = UserDrawInk.objects.get_or_create(user=request.user)
        
        # If the user is eligible to claim ink
        if user_ink.can_claim():
            user_ink.ink += 200
            user_ink.update_claim_time()
            
            # Return a JSON response with success = True, current ink balance, and the next claim time (8 hours from now)
            return JsonResponse({
                'success': True,
                'ink': user_ink.ink, 
                'next_claim': user_ink.last_claim_time + timedelta(hours=8)
            })
        
        # If the user can't claim ink yet, calculate the next claim time (8 hours from the last claim)
        next_claim_time = user_ink.last_claim_time + timedelta(hours=8)
        # Return a JSON response indicating the user is not eligible to claim yet, and provide the next claim time
        return JsonResponse({'success': False, 'next_claim': next_claim_time})
    
    return JsonResponse({'success': False})

# Returns drawing data in chunks (for performance reasons)
def drawing_data_chunks(request):
    chunk_size = 100  # Number of drawings per chunk
    page_number = request.GET.get('page', 1)
    
    drawings = Drawing.objects.all()
    paginator = Paginator(drawings, chunk_size) # Paginate the drawing data
    page = paginator.get_page(page_number)
    
    # Send the drawings for the current page as JSON
    drawing_data = [json.loads(drawing.data) for drawing in page.object_list]
    
    return JsonResponse({
        'data': drawing_data,
        'has_next': page.has_next(), # Check if there are more pages to load
        'next_page': page.next_page_number() if page.has_next() else None
    })

@login_required
def create_checkout_session(request):
    try:
        # Map of prices to ink amounts
        ink_options = {
            'option_1': {'amount': 399, 'ink': 500},    # £3.99 for 500 ink
            'option_2': {'amount': 699, 'ink': 1200},   # £6.99 for 1200 ink
            'option_3': {'amount': 999, 'ink': 2400},   # £9.99 for 2400 ink
        }

        # Parse the JSON body to get the selected option
        body = json.loads(request.body)
        selected_option = body.get('option')

        if selected_option not in ink_options:
            return JsonResponse({'error': 'Invalid option selected'}, status=400)

        selected_ink_option = ink_options[selected_option]

        # Create a new Stripe Checkout Session for the payment
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'gbp',
                        'product_data': {
                            'name': f'Draw Ink Purchase - {selected_ink_option["ink"]} ink',
                        },
                        'unit_amount': selected_ink_option['amount'],  # Amount in pence (e.g., £3.99)
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            success_url=request.build_absolute_uri('/payment/success/') + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=request.build_absolute_uri('/payment/cancel/'),
        )

        return JsonResponse({'id': checkout_session.id})

    except Exception as e:
        return JsonResponse({'error': 'An error occurred while creating the checkout session'}, status=500)


@login_required
def payment_success(request):
    session_id = request.GET.get('session_id')
    if session_id:
        session = stripe.checkout.Session.retrieve(session_id)
        payment_intent = session.payment_intent
        amount_paid = session.amount_total / 100  # Amount in pounds

        # Determine ink based on the amount paid
        if amount_paid == 3.99:
            ink_amount = 500
        elif amount_paid == 6.99:
            ink_amount = 1200
        elif amount_paid == 9.99:
            ink_amount = 2400
        else:
            ink_amount = 0

        if ink_amount > 0:
            # Update the user's draw ink balance
            user_ink, created = UserDrawInk.objects.get_or_create(user=request.user)
            user_ink.ink += ink_amount
            user_ink.save()

    return render(request, 'payment/success.html')


@login_required
def payment_cancel(request):
    return render(request, 'payment/cancel.html')